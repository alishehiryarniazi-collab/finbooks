import { prisma } from "../prisma";

// Sends push notifications through Expo's push service (which delivers via FCM on Android
// and APNs on iOS). We only store and send Expo push tokens ("ExponentPushToken[...]").

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Sends one message to many device tokens. Best-effort: never throws (a failed push must
// not break the action that triggered it).
export async function sendExpoPush(tokens: string[], msg: PushMessage): Promise<void> {
  const valid = [...new Set(tokens)].filter((t) => t && t.startsWith("ExponentPushToken"));
  if (valid.length === 0) return;

  const messages = valid.map((to) => ({
    to,
    sound: "default",
    title: msg.title,
    body: msg.body,
    data: msg.data ?? {},
  }));

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.error("Push send failed:", err);
    }
  }
}

// Notifies every active member of an org (optionally excluding one user, e.g. the person who
// triggered the event). Best-effort.
export async function notifyOrg(orgId: string, msg: PushMessage, exceptUserId?: string): Promise<void> {
  try {
    const memberships = await prisma.membership.findMany({
      where: { orgId, isActive: true },
      select: { userId: true },
    });
    const userIds = memberships.map((m) => m.userId).filter((id) => id !== exceptUserId);
    if (userIds.length === 0) return;

    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    await sendExpoPush(
      tokens.map((t) => t.token),
      msg,
    );
  } catch (err) {
    console.error("notifyOrg failed:", err);
  }
}
