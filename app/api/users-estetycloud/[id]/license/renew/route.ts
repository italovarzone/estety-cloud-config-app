export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../../lib/mongo";

async function ensureApiKey(req: Request) {
  try {
    // 🔥 CORRIGIDO: No Next.js App Router, headers devem ser lidos com .get()
    const given =
      req.headers.get("x-config-api-key") ||
      req.headers.get("X-Config-Api-Key") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    if (!process.env.CONFIG_API_KEY) {
      return NextResponse.json({ error: "config_missing" }, { status: 500 });
    }

    if (!given || given.trim() !== process.env.CONFIG_API_KEY.trim()) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    return null;
  } catch (err) {
    return NextResponse.json(
      { error: "internal_error", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const unauthorized = await ensureApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({} as any));
    const period: string | undefined = body?.period || body?.plan || body?.type;

    const lifetime: boolean =
      !!body?.lifetime || String(period).toLowerCase() === "lifetime";

    const db = await getDb();
    const _id = new ObjectId(params.id);

    const user = await db.collection("users_estetycloud").findOne({ _id });
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const now = new Date();
    const currentExp = user?.license?.expiresAt
      ? new Date(user.license.expiresAt)
      : null;

    const base =
      currentExp && currentExp.getTime() > now.getTime() ? currentExp : now;

    let expiresAt: string | null = null;
    let plan: string | undefined = undefined;

    if (lifetime) {
      expiresAt = null;
      plan = "lifetime";
    } else {
      let newDate: Date;
      const p = String(period || "").toLowerCase();

      if (p === "6m" || p === "semester" || p === "semestral" || p === "6meses") {
        newDate = new Date(base);
        newDate.setMonth(newDate.getMonth() + 6);
        plan = "semestral";
      } else {
        newDate = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
        plan = user?.license?.plan || "monthly";
      }

      expiresAt = newDate.toISOString();
    }

    const license = {
      status: "active" as const,
      plan,
      activatedAt: user?.license?.activatedAt || now.toISOString(),
      renewedAt: now.toISOString(),
      deactivatedAt: null,
      expiresAt,
    };

    await db
      .collection("users_estetycloud")
      .updateOne({ _id }, { $set: { license, updatedAt: now.toISOString() } });

    const updated = await db
      .collection("users_estetycloud")
      .findOne({ _id }, { projection: { password: 0 } });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[POST renew license] ERROR:", e);
    return NextResponse.json(
      { error: "db_error", detail: String(e) },
      { status: 500 }
    );
  }
}
