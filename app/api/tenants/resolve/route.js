// app/api/tenants/resolve/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";
import { ObjectId } from "mongodb";

// GET /api/tenants/resolve?tenant=foo
export async function GET(req) {
  try {
    // 🔐 mesma checagem de chave do /public
    const required = process.env.CONFIG_API_KEY || "";
    const given =
      req.headers.get("x-config-api-key") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    if (required && given !== required) {
      return new NextResponse("unauthorized", { status: 401 });
    }

    const referer = req.headers.get("origin") || "";
    if (!referer.includes("estetycloud") && process.env.NODE_ENV === "production") {
      return new NextResponse("forbidden", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tenant = (searchParams.get("tenant") || "").trim();
    if (!tenant) return new NextResponse("missing tenant", { status: 400 });

    const db = await getDb();

    // aceita _id, tenantId ou slug
    const query = /^[0-9a-f]{24}$/i.test(tenant)
      ? { _id: new ObjectId(tenant) }
      : { $or: [{ tenantId: tenant }, { slug: tenant }] };

    const doc = await db.collection("tenants").findOne(
      query,
      { projection: { tenantId: 1, name: 1, slug: 1, dbName: 1, mongoUri: 1, status: 1 } }
    );

    if (!doc) return new NextResponse("not found", { status: 404 });
    return NextResponse.json(doc, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tenants/resolve] ERROR:", e);
    return new NextResponse("server error", { status: 500 });
  }
}
