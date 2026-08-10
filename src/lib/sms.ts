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

/** Cyprus mobile for Alt-à-Vie: no leading 00, +357, or 357. */
export function normalizeMsisdn(phone: string) {
  let n = phone.replace(/[\s\-().]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("357")) n = n.slice(3);
  return n;
}

function buildRequestId(recallId: number) {
  return `${Date.now()}${recallId}`;
}

function applyTemplate(template: string, recall: Recall) {
  const owner = formatOwnerName(recall) || "Customer";
  const replacements: Record<string, string> = {
    name: recall.first_name.trim() || "Customer",
    surname: recall.surname.trim(),
    owner,
    reg: recall.reg_no.trim(),
    vin: recall.vin_number.trim(),
    recall_no: recall.recall_no.trim(),
    description: recall.description.trim(),
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

  const msisdn = normalizeMsisdn(telephone);
  if (!msisdn) {
    return {
      ok: false,
      message: "Telephone number is invalid after normalization.",
    };
  }

  const text = await buildRecallSmsMessage(recall);
  const providerId = buildRequestId(recall.id);

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
