import { createHash } from "node:crypto";

type Entry = { failures: number; until: number; seen: number };
export function createLoginLimiter() {
  const entries = new Map<string, Entry>();
  let active = 0;
  return (login: string, ip: string, now = Date.now()) => {
    for (const [key, value] of entries) if (now - value.seen > 15 * 60000) entries.delete(key);
    const keys = [`login:${login.trim().toLowerCase()}`, `ip:${ip}`].map(key => createHash("sha256").update(key).digest("hex"));
    const wait = Math.max(0, ...keys.map(key => (entries.get(key)?.until ?? 0) - now));
    if (wait > 0 || active >= 8 || entries.size >= 10000) return { retryAfter: Math.max(1, Math.ceil(wait / 1000)), finish: (success: boolean) => { void success; } };
    active++; let finished = false;
    // Count reservations, so concurrent attempts cannot race the failure counter.
    for (const key of keys) {
      const previous = entries.get(key);
      const failures = (previous?.failures ?? 0) + 1;
      entries.set(key, { failures, seen: now, until: failures >= 5 ? now + Math.min(900000, 1000 * 2 ** Math.min(10, failures - 5)) : 0 });
    }
    return { retryAfter: 0, finish(success: boolean) {
      if (finished) return; finished = true; active--;
      if (success) for (const key of keys) entries.delete(key);
    } };
  };
}
export const reserveLogin = createLoginLimiter();
