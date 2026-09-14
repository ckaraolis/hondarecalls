import type { Recall } from "@/lib/db";
import {
  DEFAULT_SMS_TEMPLATE,
  SMS_MAX_LENGTH,
  formatOwnerName,
  getSmsTemplate,
} from "@/lib/db";

export type SmsSendResult = {
  ok: boolean;
  message: string;
  preview?: string;
  providerId?: string;
  length?: number;
};

export { SMS_MAX_LENGTH, DEFAULT_SMS_TEMPLATE };

const DEFAULT_ENDPOINT =
  "https://www.altavie.com.cy/getusms/receive.aspx";

function getEndpoint() {
  return process.env.ALTAVIE_SMS_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
}

function getLogin() {
  return (
    process.env.ALTAVIE_SMS_LOGIN?.trim() ||
    process.env.ALTAVIE_SMS_USERNAME?.trim() ||
    ""
  );
}

function getPassword() {
  return (
    process.env.ALTAVIE_SMS_PASSWORD?.trim() ||
    process.env.ALTAVIE_SMS_API_KEY?.trim() ||
    ""
  );
}

function getSenderId() {
  return process.env.ALTAVIE_SMS_SENDER?.trim() || "";
}

function isSmsConfigured() {
  return Boolean(getLogin() && getPassword() && getSenderId());
}

function isCreditsConfigured() {
  return Boolean(getLogin() && getPassword());
}

function parseCredits(body: string): number | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      for (const key of ["credits", "Credits", "balance", "Balance", "credit"]) {
        const value = record[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
          const n = Number(value.replace(",", "."));
          if (Number.isFinite(n)) return n;
        }
      }
    }
  } catch {
    // Plain text / HTML from Alt-à-Vie.
  }

  const plain = trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lowered = plain.toLowerCase();
  if (
    /invalid|error|fail|denied|unauthorized|wrong password|login failed/.test(
      lowered,
    ) &&
    !/\d/.test(plain)
  ) {
    return null;
  }

  const matches = plain.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches?.length) return null;
  if (/^-?\d+(?:[.,]\d+)?$/.test(plain)) {
    const n = Number(plain.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const labeled = plain.match(
    /credits?\s*(?:remaining|balance)?\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/i,
  );
  if (labeled) {
    const n = Number(labeled[1].replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const last = matches[matches.length - 1].replace(",", ".");
  const n = Number(last);
  return Number.isFinite(n) ? n : null;
}

export type SmsCreditsResult = {
  ok: boolean;
  credits: number | null;
  message: string;
};

/** Remaining Alt-à-Vie SMS credits: GetCredits=Y&login=&pwd= */
export async function getSmsCredits(): Promise<SmsCreditsResult> {
  if (!isCreditsConfigured()) {
    return {
      ok: false,
      credits: null,
      message:
        "SMS credits are not configured. Set ALTAVIE_SMS_LOGIN and ALTAVIE_SMS_PASSWORD.",
    };
  }

  const url = new URL(getEndpoint());
  url.searchParams.set("GetCredits", "Y");
  url.searchParams.set("login", getLogin());
  url.searchParams.set("pwd", getPassword());

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });
    const body = (await response.text().catch(() => "")).trim();
    if (isProviderError(response.status, body) && !parseCredits(body)) {
      const statusText = summarizeProviderBody(body);
      return {
        ok: false,
        credits: null,
        message: `Could not load SMS credits (${response.status})${statusText ? `: ${statusText}` : "."}`,
      };
    }

    const credits = parseCredits(body);
    if (credits === null) {
      return {
        ok: false,
        credits: null,
        message: "Could not read the remaining SMS balance from Alt-à-Vie.",
      };
    }

    return {
      ok: true,
      credits,
      message: "SMS credits loaded.",
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown credits error.";
    return {
      ok: false,
      credits: null,
      message: `Failed to reach SMS provider: ${detail}`,
    };
  }
}

/** Cyprus mobile for Alt-à-Vie: no leading 00, +357, or 357. */
export function normalizeMsisdn(phone: string) {
  let n = phone.replace(/[\s\-().]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("357")) n = n.slice(3);
  return n;
}

function buildRequestId(suffix: string | number) {
  return `${Date.now()}${suffix}`;
}

function applyTemplate(template: string, recall: Recall) {
  const owner = formatOwnerName(recall) || "Customer";
  const replacements: Record<string, string> = {
    name: recall.first_name.trim() || "Customer",
    surname: recall.surname.trim(),
    owner,
    reg: recall.reg_no.trim(),
    vin: recall.vin_number.trim(),
    model: recall.model.trim(),
    recall_no: recall.recall_no.trim(),
    description: recall.description.trim(),
    part_number: recall.part_number.trim(),
    city: recall.city.trim(),
    engine: recall.engine_number.trim(),
  };

  return template.replace(/\{([a-z_]+)\}/gi, (_match, key: string) => {
    const value = replacements[key.toLowerCase()];
    return value ?? "";
  });
}

/** Build final SMS text from saved template, capped at 160 characters. */
export async function buildRecallSmsMessage(
  recall: Recall,
  template?: string,
): Promise<string> {
  const source =
    (template ?? (await getSmsTemplate())).trim() || DEFAULT_SMS_TEMPLATE;
  const rendered = applyTemplate(source, recall).replace(/\s+/g, " ").trim();
  if (rendered.length <= SMS_MAX_LENGTH) return rendered;
  return rendered.slice(0, SMS_MAX_LENGTH);
}

function summarizeProviderBody(body: string) {
  const plain = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "";

  // Alt-à-Vie often returns "OK" then an HTML page.
  const okMatch = plain.match(/\bOK\b/i);
  if (okMatch) return "OK";

  return plain.slice(0, 120);
}

function isProviderError(status: number, body: string) {
  if (!status || status >= 400) return true;

  const plain = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (/\bok\b/.test(plain)) return false;

  return (
    plain.includes("error") ||
    plain.includes("fail") ||
    plain.includes("invalid") ||
    plain.includes("denied") ||
    plain.includes("unauthorized")
  );
}

/**
 * Sends a plain SMS to one normalized MSISDN via Alt-à-Vie GET API.
 */
export async function sendSmsToNumber(
  telephone: string,
  message: string,
  requestSuffix: string | number = "c",
): Promise<SmsSendResult> {
  const raw = telephone.trim();
  if (!raw) {
    return { ok: false, message: "Telephone number is empty." };
  }

  const msisdn = normalizeMsisdn(raw);
  if (!msisdn) {
    return {
      ok: false,
      message: "Telephone number is invalid after normalization.",
    };
  }

  const text = message.replace(/\s+/g, " ").trim().slice(0, SMS_MAX_LENGTH);
  if (!text) {
    return { ok: false, message: "SMS message is empty." };
  }

  const providerId = buildRequestId(requestSuffix);

  if (process.env.ALTAVIE_SMS_DRY_RUN === "true") {
    return {
      ok: true,
      message: `DRY RUN: SMS marked as sent to ${msisdn} (no provider call).`,
      preview: text,
      providerId,
      length: text.length,
    };
  }

  if (!isSmsConfigured()) {
    return {
      ok: false,
      message:
        "SMS is not configured yet. Set ALTAVIE_SMS_LOGIN, ALTAVIE_SMS_PASSWORD, and ALTAVIE_SMS_SENDER in .env.local. For local testing set ALTAVIE_SMS_DRY_RUN=true.",
      preview: text,
      length: text.length,
    };
  }

  const endpoint = getEndpoint();
  const login = getLogin();
  const pwd = getPassword();
  const srvno = getSenderId();

  const url = new URL(endpoint);
  url.searchParams.set("id", providerId);
  url.searchParams.set("msisdn", msisdn);
  url.searchParams.set("sms", text);
  url.searchParams.set("srvno", srvno);
  url.searchParams.set("provider", "Cyta");
  url.searchParams.set("login", login);
  url.searchParams.set("pwd", pwd);

  try {
    const response = await fetch(url.toString(), { method: "GET" });
    const body = (await response.text().catch(() => "")).trim();
    const statusText = summarizeProviderBody(body);

    if (isProviderError(response.status, body)) {
      return {
        ok: false,
        message: `SMS provider error (${response.status})${statusText ? `: ${statusText}` : ""}`,
        preview: text,
        providerId,
        length: text.length,
      };
    }

    return {
      ok: true,
      message: `SMS sent to ${msisdn}${statusText ? ` (${statusText})` : ""}.`,
      preview: text,
      providerId,
      length: text.length,
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown SMS send error.";
    return {
      ok: false,
      message: `Failed to reach SMS provider: ${detail}`,
      preview: text,
      providerId,
      length: text.length,
    };
  }
}

/**
 * Sends a recall SMS via Alt-à-Vie GET API:
 * .../getusms/receive.aspx?id=&msisdn=&sms=&srvno=&provider=Cyta&login=&pwd=
 */
export async function sendRecallSms(recall: Recall): Promise<SmsSendResult> {
  const telephone = recall.telephone.trim();
  if (!telephone) {
    return {
      ok: false,
      message: "This record has no telephone number.",
    };
  }

  const text = await buildRecallSmsMessage(recall);
  return sendSmsToNumber(telephone, text, recall.id);
}

/** Parse numbers separated by newline, comma, semicolon, or spaces. */
export function parsePhoneList(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .flatMap((chunk) => chunk.trim().split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const phone of parts) {
    const key = normalizeMsisdn(phone) || phone;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(phone);
  }
  return unique;
}

export async function sendCustomSmsToMany(
  phones: string[],
  message: string,
): Promise<{
  ok: boolean;
  total: number;
  sent: number;
  failed: number;
  skippedInvalid: number;
  failures: { phone: string; message: string }[];
  preview: string;
  message: string;
}> {
  const text = message.replace(/\s+/g, " ").trim().slice(0, SMS_MAX_LENGTH);
  const list = phones.map((phone) => phone.trim()).filter(Boolean);

  let sent = 0;
  let failed = 0;
  let skippedInvalid = 0;
  const failures: { phone: string; message: string }[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const phone = list[i];
    if (!normalizeMsisdn(phone)) {
      skippedInvalid += 1;
      failures.push({ phone, message: "Invalid telephone number." });
      continue;
    }
    const result = await sendSmsToNumber(phone, text, `c${i}`);
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      failures.push({ phone, message: result.message });
    }
  }

  return {
    ok: sent > 0 && failed === 0 && skippedInvalid === 0,
    total: list.length,
    sent,
    failed,
    skippedInvalid,
    failures: failures.slice(0, 20),
    preview: text,
    message: `Custom SMS: sent ${sent}, failed ${failed}, skipped ${skippedInvalid} (invalid).`,
  };
}
