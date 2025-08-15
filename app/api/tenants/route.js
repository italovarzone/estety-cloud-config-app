export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongo";


// GET /api/tenants
export async function GET() {
  try {
    const db = await getDb();
    const list = await db
      .collection("tenants")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tenants] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}

// POST /api/tenants
export async function POST(req) {
  try {
    const payload = await req.json();
    for (const r of ["tenantId", "name", "dbName"]) {
      if (!payload[r]) return new NextResponse(`Campo obrigatório: ${r}`, { status: 400 });
    }

    const doc = {
      tenantId: String(payload.tenantId).trim(),
      name: String(payload.name).trim(),
      slug: payload.slug ? String(payload.slug).trim() : null,
      dbName: String(payload.dbName).trim(),
      mongoUri: payload.mongoUri ? String(payload.mongoUri).trim() : null,
      status: payload.status === "inactive" ? "inactive" : "active",
      createdAt: new Date().toISOString(),
    };

    const db = await getDb();
    const or = [{ tenantId: doc.tenantId }];
    if (doc.slug) or.push({ slug: doc.slug });
    const exists = await db.collection("tenants").findOne({ $or: or });
    if (exists) return new NextResponse("tenantId ou slug já existe", { status: 409 });

    const { insertedId } = await db.collection("tenants").insertOne(doc);
    const created = await db.collection("tenants").findOne({ _id: insertedId });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tenants] ERROR:", e);
    return new NextResponse("Erro ao criar tenant", { status: 500 });
  }
}
