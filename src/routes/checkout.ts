import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import { stripe } from "../lib/stripe.js";
import { getPriceId } from "../lib/plans.js";
import { CheckoutRequestSchema } from "../types/index.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = CheckoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { app_id, user_id, plan, success_url, cancel_url } = parsed.data;

  const priceId = getPriceId(app_id, plan);
  if (!priceId) {
    return c.json({ error: `No price configured for app "${app_id}" plan "${plan}"` }, 400);
  }

  // Find or create Stripe Customer
  const existing = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, user_id), eq(subscriptions.appId, app_id)),
  });

  let stripeCustomerId = existing?.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      metadata: { user_id, app_id },
    });
    stripeCustomerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url,
    cancel_url,
    metadata: { user_id, app_id, plan },
  });

  return c.json({ checkout_url: session.url });
});

export default app;
