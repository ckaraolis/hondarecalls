import webpush from "web-push";
import type { PublicRecall } from "@/lib/db";
import {
  buildRecallAlertCopy,
  createNotification,
  deletePushSubscriptionByEndpoint,
  findUserIdsForRecall,
  listPushSubscriptionsForUser,
} from "@/lib/notifications";

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost";

  if (!publicKey || !privateKey) {
    return null;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
}

async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string },
) {
  if (!configureVapid()) return;

  const subscriptions = await listPushSubscriptionsForUser(userId);
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/account",
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscriptionByEndpoint(sub.endpoint);
        }
      }
    }),
  );
}

export type NotifyResult = {
  notifiedUsers: number;
  notificationsCreated: number;
};

export async function notifyUsersOfNewRecalls(
  addedRows: PublicRecall[],
): Promise<NotifyResult> {
  let notificationsCreated = 0;
  const notifiedUserIds = new Set<number>();

  for (const row of addedRows) {
    const userIds = await findUserIdsForRecall(row);
    if (userIds.length === 0) continue;

    const copy = buildRecallAlertCopy(row);

    for (const userId of userIds) {
      const created = await createNotification({
        user_id: userId,
        title: copy.title,
        body: copy.body,
        reg_no: copy.reg_no,
        recall_no: copy.recall_no,
      });

      if (!created) continue;

      notificationsCreated += 1;
      notifiedUserIds.add(userId);
      await sendPushToUser(userId, {
        title: copy.title,
        body: copy.body,
        url: "/account",
      });
    }
  }

  return {
    notifiedUsers: notifiedUserIds.size,
    notificationsCreated,
  };
}
