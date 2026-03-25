import { z } from "zod";

export const CheckoutRequestSchema = z.object({
  app_id: z.string().min(1),
  user_id: z.string().min(1),
  plan: z.enum(["pro", "enterprise"]),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

export const PortalRequestSchema = z.object({
  app_id: z.string().min(1),
  user_id: z.string().min(1),
  return_url: z.string().url(),
});

export const SubscriptionQuerySchema = z.object({
  app_id: z.string().min(1),
  user_id: z.string().min(1),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
export type PortalRequest = z.infer<typeof PortalRequestSchema>;
export type SubscriptionQuery = z.infer<typeof SubscriptionQuerySchema>;
