// app/api/directives/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongo";
import { ObjectId } from "mongodb";

// GET /api/directives
export async function GET() {
  try {
    const db = await getDb();
    const list = await db.collection("directives").find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/directives] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}

// POST /api/directives
export async function POST(req) {
  try {
    const payload = await req.json();
    const { name, code, description } = payload;

    if (!name || !code) {
      return new NextResponse("Campos obrigatórios: name e code", { status: 400 });
    }

    const db = await getDb();
    await db.collection("directives").createIndexes([
      { key: { code: 1 }, name: "uniq_code", unique: true },
    ]);

    const exists = await db.collection("directives").findOne({ code });
    if (exists) {
      return new NextResponse("Código já existe", { status: 409 });
    }

    const doc = {
      name: String(name).trim(),
      code: String(code).trim(),
      description: description ? String(description).trim() : "",
      createdAt: new Date().toISOString(),
    };

    const { insertedId } = await db.collection("directives").insertOne(doc);
    const created = await db.collection("directives").findOne({ _id: insertedId });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[POST /api/directives] ERROR:", e);
    return new NextResponse("Erro ao criar diretiva", { status: 500 });
  }
}

// PATCH /api/directives/:id
export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    const payload = await req.json();

    const db = await getDb();
    const _id = new ObjectId(id);
    const curr = await db.collection("directives").findOne({ _id });
    if (!curr) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const name = payload.name ?? curr.name;
    const description = payload.description ?? curr.description;

    await db.collection("directives").updateOne(
      { _id },
      { $set: { name, description } }
    );

    const updated = await db.collection("directives").findOne({ _id });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/directives/:id] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}

// DELETE /api/directives/:id
export async function DELETE(_, { params }) {
  try {
    const { id } = params;
    const db = await getDb();
    const _id = new ObjectId(id);
    const result = await db.collection("directives").deleteOne({ _id });
    if (!result.deletedCount) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/directives/:id] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}
