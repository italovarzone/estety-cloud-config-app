export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongo";

export async function GET(req, { params }) {
  const db = await getDb();
  const doc = await db.collection("tenants").findOne({ _id: new ObjectId(params.id) });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req, { params }) {
  const payload = await req.json();
  const update = {};
  for (const k of ["tenantId", "name", "slug", "dbName", "mongoUri", "status"]) {
    if (payload[k] !== undefined) update[k] = payload[k];
  }
  if (!Object.keys(update).length) return new NextResponse("Nada para atualizar", { status: 400 });

  const db = await getDb();
  await db.collection("tenants").updateOne({ _id: new ObjectId(params.id) }, { $set: update });
  const doc = await db.collection("tenants").findOne({ _id: new ObjectId(params.id) });
  return NextResponse.json(doc);
}

export async function DELETE(req, { params }) {
  const db = await getDb();
  const r = await db.collection("tenants").deleteOne({ _id: new ObjectId(params.id) });
  if (!r.deletedCount) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ ok: true });
}
