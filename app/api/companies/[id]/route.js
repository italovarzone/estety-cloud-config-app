export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongo";

export async function GET(req, { params }) {
  const db = await getDb();
  const doc = await db.collection("companies").findOne({ _id: new ObjectId(params.id) });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req, { params }) {
  const payload = await req.json();
  const update = {};
  for (const k of ["name","cep","rua","titulo","bairro","cidade","uf","cnpjCpf","numeroContato","tenantRef"]) {
    if (payload[k] !== undefined) update[k] = payload[k];
  }
  const db = await getDb();

  if (update.tenantRef) {
    const tenant = await db.collection("tenants").findOne({ _id: new ObjectId(update.tenantRef) });
    if (!tenant) return new NextResponse("Tenant inválido", { status: 400 });
    update.tenantRef = tenant._id;
    update.tenantId = tenant.tenantId;
    update.tenantName = tenant.name;
  }

  await db.collection("companies").updateOne({ _id: new ObjectId(params.id) }, { $set: update });
  const doc = await db.collection("companies").findOne({ _id: new ObjectId(params.id) });
  return NextResponse.json(doc);
}

export async function DELETE(req, { params }) {
  const db = await getDb();
  const r = await db.collection("companies").deleteOne({ _id: new ObjectId(params.id) });
  if (!r.deletedCount) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ ok: true });
}
