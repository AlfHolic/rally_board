"use server";

import webpush from "web-push";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";
const VAPID_PUBLIC = "BBQaJL_i52GyqnmZT2dajaaXA02qdeuYBCdAKlpU4Rky5f1RDywIHA8pJtnLDmoNE-Y9DZbRutUucwSqglr8dOc";

type Sub = { endpoint: string; p256dh: string; auth: string };
type Item = { title: string; body: string; url: string; tag: string; subs: Sub[] };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Sends any pending "waitlist -> going" notifications. Safe to call any time; each one goes out once. */
export async function flushPromotions(): Promise<number> {
  const secret = process.env.PUSH_SECRET;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !priv) return 0;
  const items = await rpc<Item[]>("rb_take_promotion_pushes", { p_secret: secret });
  if (!items?.length) return 0;
  webpush.setVapidDetails("mailto:rallyboard@example.com", VAPID_PUBLIC, priv);
  await Promise.allSettled(
    items.flatMap((it) =>
      it.subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: it.tag }),
            { TTL: 60 * 60 * 24 },
          );
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await rpc("rb_drop_push", { p_secret: secret, p_endpoint: s.endpoint });
        }
      }),
    ),
  );
  return items.length;
}
