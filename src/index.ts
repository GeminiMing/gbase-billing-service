import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { authMiddleware } from "./lib/auth.js";
import checkoutRoute from "./routes/checkout.js";
import portalRoute from "./routes/portal.js";
import subscriptionRoute from "./routes/subscription.js";
import webhooksRoute from "./routes/webhooks.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Webhook route (no auth — Stripe verifies via signature)
app.route("/api/webhooks/stripe", webhooksRoute);

// Authenticated routes
app.use("/api/billing/*", authMiddleware);
app.route("/api/billing/checkout", checkoutRoute);
app.route("/api/billing/portal", portalRoute);
app.route("/api/billing/subscription", subscriptionRoute);

const port = Number(process.env.PORT) || 3100;
console.log(`GBase Billing Service running on port ${port}`);
serve({ fetch: app.fetch, port });
