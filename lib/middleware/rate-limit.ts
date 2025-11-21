const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { success: true };
  }
  if (entry.count >= limit) {
    return { success: false, retryAfter: entry.reset - now };
  }
  entry.count += 1;
  return { success: true };
}
