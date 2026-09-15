import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "honda_admin_session";

export type AdminPermission = "full" | "custom-sms";

export type AdminSession = {
  username: string;
  permissions: AdminPermission[];
};

type AdminAccount = {
  username: string;
  password: string;
  permissions: AdminPermission[];
};

function getSecret() {
  return process.env.SESSION_SECRET || "dev-secret";
}

function getAdminUsername() {
  return (process.env.ADMIN_USERNAME || "admin").trim() || "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "honda";
}

function getSmsOperatorUsername() {
  return (process.env.SMS_OPERATOR_USERNAME || "Nicolas").trim() || "Nicolas";
}

function getSmsOperatorPassword() {
  return process.env.SMS_OPERATOR_PASSWORD || "Honda.123";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function safeEqualString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sessionToken(username: string) {
  return `${username}.${sign(`admin:${username}`)}`;
}

function parseSessionToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const username = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!username || !signature) return null;
  const expected = sign(`admin:${username}`);
  if (!safeEqualString(signature, expected)) return null;
  return username;
}

function listAdminAccounts(): AdminAccount[] {
  const accounts: AdminAccount[] = [
    {
      username: getAdminUsername(),
      password: getAdminPassword(),
      permissions: ["full"],
    },
  ];

  const operatorUsername = getSmsOperatorUsername();
  if (
    operatorUsername.toLowerCase() !== getAdminUsername().toLowerCase()
  ) {
    accounts.push({
      username: operatorUsername,
      password: getSmsOperatorPassword(),
      permissions: ["custom-sms"],
    });
  }

  return accounts;
}

function findAccountByUsername(username: string): AdminAccount | null {
  const needle = username.trim().toLowerCase();
  if (!needle) return null;
  return (
    listAdminAccounts().find(
      (account) => account.username.toLowerCase() === needle,
    ) ?? null
  );
}

export function verifyCredentials(username: string, password: string) {
  const account = findAccountByUsername(username);
  if (!account) return false;
  return safeEqualString(password, account.password);
}

export function getAccountPermissions(username: string): AdminPermission[] {
  return findAccountByUsername(username)?.permissions ?? [];
}

export function hasAdminPermission(
  session: AdminSession | null,
  permission: AdminPermission,
) {
  if (!session) return false;
  if (session.permissions.includes("full")) return true;
  return session.permissions.includes(permission);
}

export async function createSession(username: string) {
  const account = findAccountByUsername(username);
  if (!account) {
    throw new Error("Unknown admin account.");
  }
  const jar = await cookies();
  jar.set(COOKIE_NAME, sessionToken(account.username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const username = parseSessionToken(token);
  if (!username) return null;
  const account = findAccountByUsername(username);
  if (!account) return null;
  return {
    username: account.username,
    permissions: account.permissions,
  };
}

export async function isAuthenticated() {
  return (await getAdminSession()) !== null;
}

export async function requireAdminPermission(permission: AdminPermission) {
  const session = await getAdminSession();
  if (!session) {
    return { ok: false as const, status: 401 as const, session: null };
  }
  if (!hasAdminPermission(session, permission)) {
    return { ok: false as const, status: 403 as const, session };
  }
  return { ok: true as const, status: 200 as const, session };
}
