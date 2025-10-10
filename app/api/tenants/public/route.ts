export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";

// GET /api/tenants/public
export async function GET(req: Request) {
  try {
    const required = process.env.CONFIG_API_KEY || "";
    const given =
      req.headers.get("x-config-api-key") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    if (required && given !== required) {
      return new NextResponse("unauthorized", { 
        status: 401,
        headers: corsHeaders
      });
    }

    const db = await getDb();
    const items = await db
      .collection("tenants")
      .find({ status: { $ne: "deleted" } })
      .project({ tenantId: 1, name: 1, slug: 1, dbName: 1, mongoUri: 1 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(items, { headers: { ...corsHeaders, "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tenants/public] ERROR:", e);
    return new NextResponse("server error", { status: 500, headers: corsHeaders });
  }
}

// OPTIONS handler para preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Headers globais de CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-config-api-key"
};
