import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongo";

// GET /api/tenants/:id
export async function GET(req, { params }) {
  const { id } = params;
  const db = await getDb();
  const doc = await db.collection("tenants").findOne({ _id: new ObjectId(id) });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(doc);
}

// PATCH /api/tenants/:id
export async function PATCH(req, { params }) {
  const { id } = params;
  const payload = await req.json();
  const db = await getDb();

  const update = {};
  for (const k of ["tenantId", "name", "slug", "dbName", "mongoUri", "status"]) {
    if (payload[k] !== undefined) update[k] = payload[k];
  }
  if (!Object.keys(update).length) return new NextResponse("Nada para atualizar", { status: 400 });

  await db.collection("tenants").updateOne({ _id: new ObjectId(id) }, { $set: update });
  const doc = await db.collection("tenants").findOne({ _id: new ObjectId(id) });
  return NextResponse.json(doc);
}

// DELETE /api/tenants/:id
export async function DELETE(req, { params }) {
  const { id } = params;
  const db = await getDb();
  const r = await db.collection("tenants").deleteOne({ _id: new ObjectId(id) });
  if (!r.deletedCount) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ ok: true });
}
