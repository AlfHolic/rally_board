"use server";

import type { Ranking, Result } from "./actions";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";

export async function getRanking(period: "all" | "month", kind: "host" | "attend"): Promise<Result<Ranking>> {
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/rb_ranking`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_period: period, p_kind: kind }),
      cache: "no-store",
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, error: body?.message || "랭킹을 불러오지 못했어요." };
    return { ok: true, data: body as Ranking };
  } catch {
    return { ok: false, error: "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해주세요." };
  }
}
