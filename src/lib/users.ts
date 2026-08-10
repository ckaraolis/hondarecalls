import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getSupabase } from "@/lib/supabase";

export type User = {
  id: number;
  email: string;
  first_name: string;
  surname: string;
  telephone: string;
  city: string;
  email_verified: number;
  created_at: string;
};

export type PublicUser = Omit<User, never>;

type UserRow = User & { password_hash: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt?: string) {
  const usedSalt = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(password, usedSalt, 64).toString("hex");
  return `${usedSalt}:${hash}`;
}

function verifyPasswordHash(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    email: String(row.email ?? ""),
    first_name: String(row.first_name ?? ""),
    surname: String(row.surname ?? ""),
    telephone: String(row.telephone ?? ""),
    city: String(row.city ?? ""),
    email_verified: Number(row.email_verified) ? 1 : 0,
    created_at: String(row.created_at ?? ""),
  };
}

function toPublicUser(row: UserRow | User): PublicUser {
  return {
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    surname: row.surname,
    telephone: row.telephone,
    city: row.city,
    email_verified: row.email_verified,
    created_at: row.created_at,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, password_hash, first_name, surname, telephone, city, email_verified, created_at",
    )
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...mapUser(data as Record<string, unknown>),
    password_hash: String(data.password_hash ?? ""),
  };
}

export async function findUserById(id: number): Promise<User | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, first_name, surname, telephone, city, email_verified, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUser(data as Record<string, unknown>) : null;
}

export async function createUser(input: {
  email: string;
  password: string;
  first_name: string;
  surname: string;
  telephone: string;
  city: string;
}): Promise<{ user: PublicUser; token: string }> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (!input.first_name.trim() || !input.surname.trim()) {
    throw new Error("Name and surname are required.");
  }
  if (!input.telephone.trim()) {
    throw new Error("Telephone number is required.");
  }
  if (!input.city.trim()) {
    throw new Error("City is required.");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const supabase = getSupabase();
  const password_hash = hashPassword(input.password);

  const { data: inserted, error } = await supabase
    .from("users")
    .insert({
      email,
      password_hash,
      first_name: input.first_name.trim(),
      surname: input.surname.trim(),
      telephone: input.telephone.trim(),
      city: input.city.trim(),
      email_verified: 0,
    })
    .select(
      "id, email, first_name, surname, telephone, city, email_verified, created_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("An account with this email already exists.");
    }
    throw new Error(error.message);
  }

  const user = mapUser(inserted as Record<string, unknown>);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const { error: tokenError } = await supabase
    .from("email_verification_tokens")
    .insert({
      token,
      user_id: user.id,
      expires_at: expiresAt,
    });

  if (tokenError) throw new Error(tokenError.message);

  return { user, token };
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const user = await findUserByEmail(email);
  if (!user || !verifyPasswordHash(password, user.password_hash)) {
    return { ok: false, error: "Invalid email or password." };
  }
  if (!user.email_verified) {
    return {
      ok: false,
      error:
        "Please verify your email before logging in. Check your inbox for the validation link.",
    };
  }
  return { ok: true, user: toPublicUser(user) };
}

export async function verifyEmailToken(
  token: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  if (!token.trim()) {
    return { ok: false, error: "Missing verification token." };
  }

  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from("email_verification_tokens")
    .select("token, user_id, expires_at")
    .eq("token", token.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) {
    return { ok: false, error: "Invalid or already used verification link." };
  }

  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    await supabase
      .from("email_verification_tokens")
      .delete()
      .eq("token", token.trim());
    return { ok: false, error: "This verification link has expired." };
  }

  const userId = Number(row.user_id);
  const { error: updateError } = await supabase
    .from("users")
    .update({ email_verified: 1 })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("email_verification_tokens").delete().eq("user_id", userId);

  const user = await findUserById(userId);
  if (!user) return { ok: false, error: "User not found." };
  return { ok: true, user };
}

export function createSessionToken(userId: number) {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const payload = `user:${userId}`;
  const sig = createHash("sha256")
    .update(`${payload}:${secret}`)
    .digest("hex");
  return `${userId}.${sig}`;
}

export function readSessionToken(token: string): number | null {
  const [idPart, sig] = token.split(".");
  const userId = Number(idPart);
  if (!Number.isFinite(userId) || userId <= 0 || !sig) return null;
  const expected = createSessionToken(userId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}
