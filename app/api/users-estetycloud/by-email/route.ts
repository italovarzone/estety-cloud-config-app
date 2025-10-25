export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";

async function ensureApiKey(req: Request) {
  try {
    const headers = Object.fromEntries((req.headers as any).entries());
    const given =
      headers["x-config-api-key"] ||
      headers["X-Config-Api-Key"] ||
      (headers["authorization"] || headers["Authorization"] || "").replace(/^Bearer\s+/i, "");

    if (!process.env.CONFIG_API_KEY) {
      console.warn("[users-estetycloud/by-email] CONFIG_API_KEY não configurada");
      return NextResponse.json({ error: "config_missing" }, { status: 500 });
    }
    if (!given || given.trim() !== process.env.CONFIG_API_KEY.trim()) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
  } catch (err) {
    return NextResponse.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}

// GET /api/users-estetycloud/by-email?email=
export async function GET(req: Request) {
  const unauthorized = await ensureApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(req.url);
    const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

    const db = await getDb();
    const user = await db
      .collection("users_estetycloud")
      .findOne({ email }, { projection: {
        _id: 0,
        userId: 1,
        email: 1,
        tenantIds: 1,
        directives: 1,
        type: 1,
        pix_key: 1,
        pix_name: 1,
        city: 1,
      }});

    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json(user, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /users-estetycloud/by-email] ERROR:", e);
    return NextResponse.json({ error: "server_error", detail: String(e) }, { status: 500 });
  }
}
