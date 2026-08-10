"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  disableBrowserPush,
  enableBrowserPush,
  isBrowserPushEnabled,
  pushSupported,
  registerPushServiceWorker,
} from "@/lib/push-client";

type User = {
  id: number;
  email: string;
  first_name: string;
  surname: string;
  telephone: string;
  city: string;
};

type Vehicle = {
  id: number;
  reg_no: string;
  vin_number: string;
  vehicle_type: "Car" | "Motorbike";
  model: string;
  year: string;
  color: string;
};

type Recall = {
  id: number;
  reg_no: string;
  vin_number: string;
  recall_no: string;
  description: string;
};

const emptyForm = {
  reg_no: "",
  vin_number: "",
  vehicle_type: "Car" as "Car" | "Motorbike",
  model: "",
  year: "",
  color: "",
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [recallsLoading, setRecallsLoading] = useState(false);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [canUsePush, setCanUsePush] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    const response = await fetch("/api/account/vehicles");
    if (!response.ok) return;
    const data = await response.json();
    const list = (data.vehicles ?? []) as Vehicle[];
    setVehicles(list);
    setActiveVehicleId((current) => {
      if (current && list.some((v) => v.id === current)) return current;
      return list[0]?.id ?? null;
    });
  }, []);

  const loadRecalls = useCallback(async (vehicleId: number) => {
    setRecallsLoading(true);
    try {
      const response = await fetch(`/api/account/vehicles/${vehicleId}`);
      if (!response.ok) {
        setRecalls([]);
        return;
      }
      const data = await response.json();
      setRecalls((data.recalls ?? []) as Recall[]);
    } catch {
      setRecalls([]);
    } finally {
      setRecallsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          router.replace("/login");
          return;
        }
        const data = await response.json();
        setUser(data.user);
        await loadVehicles();
        setCanUsePush(pushSupported());
        if (pushSupported()) {
          await registerPushServiceWorker();
          const enabled = await isBrowserPushEnabled();
          setPushEnabled(enabled);
          setPushStatus(
            enabled
              ? "On — this device will get browser toasts for new recalls."
              : "Off — turn on to get browser toasts on this device.",
          );
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router, loadVehicles]);

  async function onTogglePush(nextEnabled: boolean) {
    if (pushBusy || nextEnabled === pushEnabled) return;

    setPushBusy(true);
    setPushError(null);
    setPushStatus(null);
    try {
      if (!nextEnabled) {
        await disableBrowserPush();
        setPushEnabled(false);
        setPushStatus("Off — you will not get browser toasts on this device.");
        return;
      }
      const result = await enableBrowserPush();
      if (!result.ok) {
        setPushEnabled(false);
        setPushError(result.error || "Could not enable notifications.");
        return;
      }
      setPushEnabled(true);
      setPushStatus("On — this device will get browser toasts for new recalls.");
    } catch {
      setPushEnabled(false);
      setPushError("Could not update notification settings.");
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!activeVehicleId) {
      setRecalls([]);
      return;
    }
    setShowVehicleInfo(false);
    void loadRecalls(activeVehicleId);
  }, [activeVehicleId, loadRecalls]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onAddVehicle(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/account/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not add vehicle.");
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      setMessage(`Vehicle ${data.vehicle.reg_no} added.`);
      await loadVehicles();
      setActiveVehicleId(data.vehicle.id);
    } catch {
      setError("Could not add vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteVehicle(vehicle: Vehicle) {
    const confirmed = window.confirm(
      `Remove vehicle ${vehicle.reg_no} from your account?`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/account/vehicles/${vehicle.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not remove vehicle.");
        return;
      }
      setMessage(`Vehicle ${vehicle.reg_no} removed.`);
      await loadVehicles();
    } catch {
      setError("Could not remove vehicle.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Loading account…</p>;
  }

  if (!user) return null;

  const activeVehicle =
    vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? null;

  return (
    <div className="fade-up mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="brand-mark text-xs font-bold text-[var(--honda-red)]">
          Account
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide">
          Welcome, {user.first_name}
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Add your vehicles here. When a new recall is uploaded for one of your
          registration numbers, you can be notified directly.
        </p>
      </div>

      <div className="panel space-y-3 rounded-2xl p-6 text-sm">
        <h2 className="text-lg font-semibold">Your profile</h2>
        <p>
          <span className="text-[var(--muted)]">Email:</span>{" "}
          <span className="font-semibold">{user.email}</span>
        </p>
        <p>
          <span className="text-[var(--muted)]">Name:</span>{" "}
          <span className="font-semibold">
            {user.first_name} {user.surname}
          </span>
        </p>
        <p>
          <span className="text-[var(--muted)]">Telephone:</span>{" "}
          <span className="font-semibold">{user.telephone}</span>
        </p>
        <p>
          <span className="text-[var(--muted)]">City:</span>{" "}
          <span className="font-semibold">{user.city}</span>
        </p>

        {canUsePush && (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[#f7f9fc] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--ink)]">
                  Browser notifications
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  Get a toast on this device when a new recall matches your
                  vehicle. In-app Alerts in the header still work even if this
                  switch stays Off.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-bold ${
                    pushEnabled ? "text-[var(--ok)]" : "text-[var(--muted)]"
                  }`}
                >
                  {pushBusy ? "…" : pushEnabled ? "On" : "Off"}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pushEnabled}
                  aria-label="Browser notifications"
                  disabled={pushBusy}
                  onClick={() => onTogglePush(!pushEnabled)}
                  className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${
                    pushEnabled
                      ? "border-[var(--honda-red)] bg-[var(--honda-red)]"
                      : "border-[var(--line)] bg-[#d7dde8]"
                  } ${pushBusy ? "opacity-60" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      pushEnabled ? "left-7" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
            {pushStatus && (
              <p className="mt-3 text-sm text-[var(--ok)]">{pushStatus}</p>
            )}
            {pushError && (
              <p className="mt-3 text-sm text-red-700">{pushError}</p>
            )}
          </div>
        )}
      </div>

      <section className="panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">My vehicles</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Each vehicle appears as a tab with its registration number.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary px-4 py-2 text-sm"
            onClick={() => {
              setShowForm((open) => !open);
              setError(null);
              setMessage(null);
            }}
          >
            {showForm ? "Cancel" : "Add a Vehicle"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={onAddVehicle}
            className="mt-5 space-y-4 rounded-xl border border-[var(--line)] bg-[#f7f9fc] p-4 sm:p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="reg_no">
                  Reg. Number
                </label>
                <input
                  id="reg_no"
                  className="input"
                  value={form.reg_no}
                  onChange={(e) => updateForm("reg_no", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="vin_number">
                  VIN <span className="font-normal text-[var(--muted)]">(optional)</span>
                </label>
                <input
                  id="vin_number"
                  className="input"
                  value={form.vin_number}
                  onChange={(e) => updateForm("vin_number", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="vehicle_type">
                  Type
                </label>
                <select
                  id="vehicle_type"
                  className="input"
                  value={form.vehicle_type}
                  onChange={(e) =>
                    updateForm(
                      "vehicle_type",
                      e.target.value === "Motorbike" ? "Motorbike" : "Car",
                    )
                  }
                >
                  <option value="Car">Car</option>
                  <option value="Motorbike">Motorbike</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="model">
                  Model
                </label>
                <input
                  id="model"
                  className="input"
                  value={form.model}
                  onChange={(e) => updateForm("model", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="year">
                  Year
                </label>
                <input
                  id="year"
                  className="input"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2020"
                  value={form.year}
                  onChange={(e) => updateForm("year", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="color">
                  Color
                </label>
                <input
                  id="color"
                  className="input"
                  value={form.color}
                  onChange={(e) => updateForm("color", e.target.value)}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save vehicle"}
            </button>
          </form>
        )}

        {message && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--ok)]">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {vehicles.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--muted)]">
            No vehicles yet. Click <span className="font-semibold">Add a Vehicle</span>{" "}
            to register your first one.
          </p>
        ) : (
          <>
            <div
              className="mt-5 flex flex-wrap gap-2"
              role="tablist"
              aria-label="Your vehicles"
            >
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  role="tab"
                  aria-selected={activeVehicleId === vehicle.id}
                  onClick={() => setActiveVehicleId(vehicle.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    activeVehicleId === vehicle.id
                      ? "border-[var(--honda-red)] bg-[var(--honda-red)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--honda-red)] hover:text-[var(--honda-red)]"
                  }`}
                >
                  {vehicle.reg_no}
                </button>
              ))}
            </div>

            {activeVehicle && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[var(--line)] bg-white p-5">
                  <h3 className="text-lg font-semibold">Recalls</h3>
                  {recallsLoading ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      Checking recalls…
                    </p>
                  ) : recalls.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      No current recalls available for this car (
                      {activeVehicle.vehicle_type}).
                    </p>
                  ) : (
                    <div className="mt-3">
                      <p className="mb-3 text-sm font-semibold text-[var(--warn)]">
                        {recalls.length} recall
                        {recalls.length === 1 ? "" : "s"} available
                      </p>
                      <div className="table-wrap overflow-hidden rounded-xl border border-[var(--line)]">
                        <table className="data">
                          <thead>
                            <tr>
                              <th>Recall No.</th>
                              <th>Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recalls.map((row) => (
                              <tr key={row.id}>
                                <td className="font-semibold">
                                  {row.recall_no || "—"}
                                </td>
                                <td>{row.description || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--line)] bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                    onClick={() => setShowVehicleInfo((open) => !open)}
                    aria-expanded={showVehicleInfo}
                  >
                    <span className="text-lg font-semibold">
                      Vehicle information
                    </span>
                    <span className="text-sm font-semibold text-[var(--muted)]">
                      {showVehicleInfo ? "Hide" : "Show"}
                    </span>
                  </button>
                  {showVehicleInfo && (
                    <div className="border-t border-[var(--line)] px-5 pb-5 pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                            Registration
                          </p>
                          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide">
                            {activeVehicle.reg_no}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn px-3 py-2 text-sm text-white"
                          style={{ background: "#9b1c1c" }}
                          disabled={deleting}
                          onClick={() => onDeleteVehicle(activeVehicle)}
                        >
                          {deleting ? "Removing…" : "Remove"}
                        </button>
                      </div>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-[var(--muted)]">Type</dt>
                          <dd className="font-semibold">
                            {activeVehicle.vehicle_type}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[var(--muted)]">Model</dt>
                          <dd className="font-semibold">{activeVehicle.model}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--muted)]">Year</dt>
                          <dd className="font-semibold">{activeVehicle.year}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--muted)]">Color</dt>
                          <dd className="font-semibold">{activeVehicle.color}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-[var(--muted)]">VIN</dt>
                          <dd className="font-mono font-semibold">
                            {activeVehicle.vin_number || "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/" className="btn btn-secondary">
          Search recalls
        </Link>
        <button type="button" className="btn btn-primary" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
