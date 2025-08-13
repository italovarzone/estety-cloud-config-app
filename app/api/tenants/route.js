import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongo";

// GET /api/tenants -> lista
export async function GET() {
  const db = await getDb();
  const list = await db.collection("tenants").find({}).sort({ createdAt: -1 }).toArray();
  return NextResponse.json(list);
}

// POST /api/tenants -> cria
export async function POST(req) {
  try {
    const payload = await req.json();
    const required = ["tenantId", "name", "dbName"];
    for (const r of required) {
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

    // Unicidade básica
    const exists = await db.collection("tenants").findOne({
      $or: [{ tenantId: doc.tenantId }, { slug: doc.slug }].filter((x) => x.slug !== null)
    });
    if (exists) return new NextResponse("tenantId ou slug já existe", { status: 409 });

    const { insertedId } = await db.collection("tenants").insertOne(doc);
    const created = await db.collection("tenants").findOne({ _id: insertedId });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return new NextResponse("Erro ao criar tenant", { status: 500 });
  }
}
