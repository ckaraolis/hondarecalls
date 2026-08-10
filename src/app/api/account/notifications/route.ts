import { NextResponse } from "next/server";
import {
  countUnreadNotifications,
  listNotificationsForUser,
} from "@/lib/notifications";
import { getCurrentUser } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    listNotificationsForUser(user.id),
    countUnreadNotifications(user.id),
  ]);

  return NextResponse.json({
    notifications,
    unreadCount,
  });
}
