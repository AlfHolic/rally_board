import webpush from "web-push";
import { flushPromotions } from "../../promo";
import { flushClubNotifications } from "@/lib/club-push";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";
const VAPID_PUBLIC = "BBQaJL_i52GyqnmZT2dajaaXA02qdeuYBCdAKlpU4Rky5f1RDywIHA8pJtnLDmoNE-Y9DZbRutUucwSqglr8dOc";

type Item = { title: string; body: string; url: string; tag: string; subs: { endpoint: string; p256dh: string; auth: string }[] };

export const dynamic = "force-dynamic";

// Runs daily at 09:00 KST (vercel.json). Sends dues reminders on the first day and the day before the deadline,
// and a one-time "we miss you" nudge to members idle 60+ days.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const secret = process.env.PUSH_SECRET;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !priv) return Response.json({ ok: false, reason: "push not configured" });

  const res = await fetch(`${URL}/rest/v1/rpc/rb_cron_daily`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: secret }),
    cache: "no-store",
  });
  const items = res.ok ? ((await res.json()) as Item[]) : [];
  webpush.setVapidDetails("mailto:rallyboard@example.com", VAPID_PUBLIC, priv);
  let sent = 0;
  await Promise.allSettled(
    items.flatMap((it) =>
      it.subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: it.tag }),
            { TTL: 60 * 60 * 24 },
          );
          sent++;
        } catch {
          /* expired subscriptions are cleaned up by the regular senders */
        }
      }),
    ),
  );
  const promos = await flushPromotions();
  await flushClubNotifications();
  return Response.json({ ok: true, jobs: items.length, sent, promos });
}
