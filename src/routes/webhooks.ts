import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import { stripe } from "../lib/stripe.js";
import { getPlanByPriceId } from "../lib/plans.js";
import type Stripe from "stripe";

const app = new Hono();

app.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await c.req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }

  return c.json({ received: true });
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const appId = session.metadata?.app_id;
  const plan = session.metadata?.plan;
  if (!userId || !appId || !plan) return;

  const sub = await stripe.subscriptions.retrieve(session.subscription as string);

  await db
    .insert(subscriptions)
    .values({
      userId,
      appId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: sub.id,
      plan,
      status: sub.status === "active" ? "active" : "trialing",
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    })
    .onConflictDoUpdate({
      target: [subscriptions.userId, subscriptions.appId],
      set: {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: sub.id,
        plan,
        status: sub.status === "active" ? "active" : "trialing",
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        updatedAt: new Date(),
      },
    });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) return;

  const planInfo = getPlanByPriceId(priceId);
  const status = mapStripeStatus(sub.status);

  await db
    .update(subscriptions)
    .set({
      ...(planInfo ? { plan: planInfo.plan } : {}),
      status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subId = invoice.subscription as string;
  if (!subId) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, subId));
}

function mapStripeStatus(status: string): string {
  switch (status) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled":
    case "unpaid": return "canceled";
    default: return status;
  }
}

export default app;
