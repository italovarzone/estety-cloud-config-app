export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongo";

function asObjectId(id) {
  return /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export async function GET(_req, { params }) {
  try {
    const db = await getDb();
    const { id } = params;

    const oid = asObjectId(id);
    const query = oid ? { _id: oid } : { $or: [{ tenantId: id }, { slug: id }] };

    const doc = await db
      .collection("tenants")
      .findOne(query, {
        projection: { tenantId: 1, name: 1, slug: 1, dbName: 1, mongoUri: 1, status: 1 },
      });

    if (!doc) return new NextResponse("not found", { status: 404 });
    return NextResponse.json(doc, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tenants/:id] ERROR:", e);
    return new NextResponse("server error", { status: 500 });
  }
}

export async function GET() {
  try {
    const db = await getDb();
    const list = await db.collection("tenants").find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tenants] DB ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}

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
    console.error("[POST /api/tenants] DB ERROR:", e);
    return new NextResponse("Erro ao criar tenant", { status: 500 });
  }
}
