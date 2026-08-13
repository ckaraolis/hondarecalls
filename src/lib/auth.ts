import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "honda_admin_session";

function getSecret() {
  return process.env.SESSION_SECRET || "dev-secret";
}

function getAdminUsername() {
  return (process.env.ADMIN_USERNAME || "admin").trim() || "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "honda";
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

/** Current single admin user; later this can load from a users table. */
export function verifyCredentials(username: string, password: string) {
  const expectedUser = getAdminUsername();
  const expectedPass = getAdminPassword();
  const userOk = safeEqualString(username.trim(), expectedUser);
  const passOk = safeEqualString(password, expectedPass);
  return userOk && passOk;
}

export async function createSession(username: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, sessionToken(username.trim()), {
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

export async function getAdminSession(): Promise<{ username: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const username = parseSessionToken(token);
  if (!username) return null;
  return { username };
}

export async function isAuthenticated() {
  return (await getAdminSession()) !== null;
}
