import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";

export async function GET(req) {
  const API_KEY = process.env.CONFIG_API_KEY;
  if (API_KEY) {
    const sent = req.headers.get("x-api-key");
    if (sent !== API_KEY) return new NextResponse("unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const slug = searchParams.get("slug");
  const name = searchParams.get("name");

  const q = { status: "active" };
  if (tenantId) q.tenantId = tenantId;
  else if (slug) q.slug = slug;
  else if (name) q.name = name;
  else return new NextResponse("Informe tenantId, slug ou name", { status: 400 });

  const db = await getDb();
  const t = await db.collection("tenants").findOne(q, { projection: { _id: 0 } });
  if (!t) return new NextResponse("Tenant não encontrado", { status: 404 });

  return NextResponse.json({
    tenantId: t.tenantId,
    name: t.name,
    slug: t.slug,
    dbName: t.dbName,
    mongoUri: t.mongoUri || null
  });
}
