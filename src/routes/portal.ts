import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import { stripe } from "../lib/stripe.js";
import { PortalRequestSchema } from "../types/index.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = PortalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { app_id, user_id, return_url } = parsed.data;

  const record = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, user_id), eq(subscriptions.appId, app_id)),
  });

  if (!record?.stripeCustomerId) {
    return c.json({ error: "No billing account found. User has not subscribed yet." }, 404);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url,
  });

  return c.json({ portal_url: session.url });
});

export default app;
