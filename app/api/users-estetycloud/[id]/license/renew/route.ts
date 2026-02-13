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
    const incomingPlan = String(body?.plan || body?.type || body?.reason || "subscription").trim().toLowerCase();

    const db = await getDb();
    const _id = new ObjectId(params.id);

    const user = await db.collection("users_estetycloud").findOne({ _id });
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const now = new Date();

    const license = {
      status: "active" as const,
      plan: incomingPlan || "subscription",
      activatedAt: user?.license?.activatedAt || now.toISOString(),
      renewedAt: now.toISOString(),
      deactivatedAt: null,
      expiresAt: null,
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
