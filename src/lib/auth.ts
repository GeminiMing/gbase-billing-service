import type { MiddlewareHandler } from "hono";

// Parse API_KEYS env: "app1:key1,app2:key2" → Map<key, appId>
function parseApiKeys(): Map<string, string> {
  const raw = process.env.API_KEYS ?? "";
  const map = new Map<string, string>();
  for (const entry of raw.split(",")) {
    const [appId, key] = entry.split(":");
    if (appId && key) {
      map.set(key.trim(), appId.trim());
    }
  }
  return map;
}

const apiKeys = parseApiKeys();

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const key = c.req.header("X-API-Key");
  if (!key || !apiKeys.has(key)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("authenticatedAppId" as never, apiKeys.get(key)! as never);
  await next();
};
