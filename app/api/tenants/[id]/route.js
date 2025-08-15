export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";
import { ObjectId } from "mongodb";

function asObjectId(id) {
  return /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

// GET /api/tenants/:id   (aceita _id, tenantId ou slug)
export async function GET(_req, { params }) {
  try {
    const { id } = params;
    const db = await getDb();

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