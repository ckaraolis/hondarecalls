import { cookies } from "next/headers";
import {
  createSessionToken,
  findUserById,
  readSessionToken,
  type PublicUser,
} from "@/lib/users";

const USER_COOKIE = "honda_user_session";

export async function createUserSession(userId: number) {
  const jar = await cookies();
  jar.set(USER_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearUserSession() {
  const jar = await cookies();
  jar.delete(USER_COOKIE);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  if (!token) return null;
  const userId = readSessionToken(token);
  if (!userId) return null;
  const user = await findUserById(userId);
  if (!user || !user.email_verified) return null;
  return user;
}
