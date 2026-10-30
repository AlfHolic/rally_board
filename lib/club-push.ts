import "server-only";
import webpush from "web-push";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";
const VAPID_PUBLIC = "BBQaJL_i52GyqnmZT2dajaaXA02qdeuYBCdAKlpU4Rky5f1RDywIHA8pJtnLDmoNE-Y9DZbRutUucwSqglr8dOc";
type Push = { id: number; title: string; body: string; url: string; subs: { endpoint: string; p256dh: string; auth: string }[] };

export async function flushClubNotifications() {
  const secret = process.env.PUSH_SECRET;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !privateKey) return;
  const rpc = async (name: string, args: Record<string, unknown>) => fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: secret, ...args }), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  try {
    const res = await rpc("rb_claim_club_pushes", {});
    if (!res.ok) return;
    const items = await res.json() as Push[];
    webpush.setVapidDetails("mailto:rallyboard@example.com", VAPID_PUBLIC, privateKey);
    for (const item of items) {
      const outcomes = await Promise.allSettled(item.subs.map(async s => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: item.title, body: item.body, url: item.url, tag: `club-${item.id}` }), { TTL: 86400, timeout: 15000 });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status !== 404 && status !== 410) throw e;
          const cleanup = await rpc("rb_drop_push", { p_endpoint: s.endpoint });
          if (!cleanup.ok) throw new Error("Expired subscription cleanup failed");
        }
      }));
      await rpc("rb_finish_club_push", { p_id: item.id, p_ok: outcomes.every(r => r.status === "fulfilled") });
    }
  } catch {
    // The claim expires; unacknowledged messages remain available for retry.
  }
}
