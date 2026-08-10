"use client";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActiveWorker(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (registration.active) return registration;

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<void>((resolve) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) {
        resolve();
        return;
      }
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated" || registration.active) {
          resolve();
        }
      });
    }),
    sleep(4000),
  ]);

  return registration;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await waitForActiveWorker(registration);
    if (!registration.active) {
      await navigator.serviceWorker.ready;
    }
    return registration;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const response = await fetch("/api/account/push-config");
    if (!response.ok) return null;
    const data = await response.json();
    const key = String(data.publicKey ?? "").trim();
    return key || null;
  } catch {
    return null;
  }
}

function explainPushError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Could not enable push notifications.";
  const lower = message.toLowerCase();

  if (
    lower.includes("push service not available") ||
    lower.includes("push service error") ||
    lower.includes("registration failed")
  ) {
    return (
      "Your browser could not reach its push service. " +
      "If you use Brave: open brave://settings/privacy and enable " +
      "“Use Google services for push messaging”. " +
      "In Chrome/Edge: check Windows Settings → System → Notifications " +
      "and allow the browser. In-app Alerts still work without this."
    );
  }

  return message;
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser did not return a complete push subscription.");
  }

  const response = await fetch("/api/account/push-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not save push subscription.");
  }
}

async function subscribeWithRetry(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  const options: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (attempt > 0) await sleep(700 * attempt);
      await waitForActiveWorker(registration);
      return await registration.pushManager.subscribe(options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not subscribe to push.");
}

export async function enableBrowserPush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: "Push notifications are not supported in this browser." };
  }

  if (!window.isSecureContext) {
    return {
      ok: false,
      error: "Notifications need a secure connection (https or localhost).",
    };
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    return { ok: false, error: "Push is not configured (missing VAPID public key)." };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "Notifications are blocked in your browser. Allow them for this site in browser settings."
          : "Notification permission was not granted.",
    };
  }

  const registration = await registerPushServiceWorker();
  if (!registration) {
    return { ok: false, error: "Could not register the service worker." };
  }

  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await saveSubscription(existing);
      return { ok: true };
    }

    const subscription = await subscribeWithRetry(registration, publicKey);
    await saveSubscription(subscription);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: explainPushError(error) };
  }
}

export async function disableBrowserPush(): Promise<void> {
  if (!pushSupported()) return;

  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ||
    (await navigator.serviceWorker.getRegistration("/sw.js"));
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/account/push-subscription", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);

  await subscription.unsubscribe().catch(() => undefined);
}

export async function isBrowserPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ||
    (await navigator.serviceWorker.getRegistration("/sw.js"));
  const subscription = await registration?.pushManager.getSubscription();
  return Boolean(subscription);
}
