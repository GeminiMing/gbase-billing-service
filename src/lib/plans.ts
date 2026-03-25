export type PlanName = "free" | "pro" | "enterprise";

interface PlanConfig {
  pro: string;       // Stripe Price ID
  enterprise: string; // Stripe Price ID
}

// Each app's Stripe Price IDs — fill in after creating Products in Stripe Dashboard
export const APP_PLANS: Record<string, PlanConfig> = {
  // Example:
  // "myapp": {
  //   pro: "price_1Qxxxxx",
  //   enterprise: "price_1Qyyyyy",
  // },
};

export function getPriceId(appId: string, plan: PlanName): string | null {
  if (plan === "free") return null;
  const appConfig = APP_PLANS[appId];
  if (!appConfig) return null;
  return appConfig[plan] ?? null;
}

export function getPlanByPriceId(priceId: string): { appId: string; plan: PlanName } | null {
  for (const [appId, config] of Object.entries(APP_PLANS)) {
    if (config.pro === priceId) return { appId, plan: "pro" };
    if (config.enterprise === priceId) return { appId, plan: "enterprise" };
  }
  return null;
}
