export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongo";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const payload = await req.json();
    const db = await getDb();
    const _id = new ObjectId(params.id);
    const curr = await db.collection("users_estetycloud").findOne({ _id });
    if (!curr) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const upd: any = {};
    if (payload.email) upd.email = String(payload.email).trim().toLowerCase();
    if (payload.password) upd.password = String(payload.password).trim();
    if (payload.directives) upd.directives = payload.directives;
    if (payload.tenantIds) upd.tenantIds = payload.tenantIds;
    if (payload.type != null) upd.type = payload.type === 1 ? 1 : 0;
    upd.updatedAt = new Date().toISOString();

    if (upd.email) {
      const exists = await db.collection("users_estetycloud").findOne({
        email: upd.email,
        _id: { $ne: _id },
      });
      if (exists) return NextResponse.json({ error: "email_conflict" }, { status: 409 });
    }

    await db.collection("users_estetycloud").updateOne({ _id }, { $set: upd });
    const updated = await db.collection("users_estetycloud").findOne({ _id }, { projection: { password: 0 } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/users-estetycloud/:id] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const _id = new ObjectId(params.id);
    const result = await db.collection("users_estetycloud").deleteOne({ _id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/users-estetycloud/:id] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}
