import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import { SubscriptionQuerySchema } from "../types/index.js";

const app = new Hono();

app.get("/", async (c) => {
  const query = c.req.query();
  const parsed = SubscriptionQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: "Invalid query", details: parsed.error.flatten() }, 400);
  }

  const { app_id, user_id } = parsed.data;

  const record = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, user_id), eq(subscriptions.appId, app_id)),
  });

  if (!record) {
    return c.json({ plan: "free", status: "active", current_period_end: null });
  }

  return c.json({
    plan: record.plan,
    status: record.status,
    current_period_end: record.currentPeriodEnd?.toISOString() ?? null,
  });
});

export default app;
