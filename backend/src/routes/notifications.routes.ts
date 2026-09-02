import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { sendExpoPush } from "../services/push";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const tokenSchema = z.object({
  token: z.string().min(1),
  platform: z.string().max(20).optional(),
});

// Register (or refresh) this device's push token for the logged-in user.
notificationsRouter.post("/token", async (req, res) => {
  const { token, platform } = tokenSchema.parse(req.body);
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, platform, userId: req.auth!.userId },
    update: { userId: req.auth!.userId, platform }, // token may move to a different user
  });
  res.status(201).json({ ok: true });
});

// Remove a token (e.g. on logout) so the device stops receiving notifications.
notificationsRouter.delete("/token", async (req, res) => {
  const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
  await prisma.pushToken.deleteMany({ where: { token, userId: req.auth!.userId } });
  res.json({ ok: true });
});

// Send a test notification to the current user's devices — handy to verify setup.
notificationsRouter.post("/test", async (req, res) => {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: req.auth!.userId },
    select: { token: true },
  });
  await sendExpoPush(
    tokens.map((t) => t.token),
    { title: "FinBooks", body: "Test notification ✅ Push is working!" },
  );
  res.json({ ok: true, sentTo: tokens.length });
});
