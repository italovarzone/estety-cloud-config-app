export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongo";

// GET list
export async function GET() {
  try {
    const db = await getDb();
    const list = await db.collection("companies").aggregate([
      { $lookup: { from: "tenants", localField: "tenantRef", foreignField: "_id", as: "tenant" } },
      { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 1, tenantRef: 1,
          name: 1, cep:1, rua:1, titulo:1, bairro:1, cidade:1, uf:1, cnpjCpf:1, numeroContato:1,
          tenantId: 1, tenantName: 1, createdAt:1
      } }
    ]).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/companies] DB ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}

// POST create
export async function POST(req) {
  try {
    const payload = await req.json();
    const required = ["name", "cep", "rua", "bairro", "cidade", "uf", "cnpjCpf", "numeroContato", "tenantRef"];
    for (const r of required) if (!payload[r]) return new NextResponse(`Campo obrigatório: ${r}`, { status: 400 });

    const db = await getDb();
    const tenant = await db.collection("tenants").findOne({ _id: new ObjectId(payload.tenantRef) });
    if (!tenant) return new NextResponse("Tenant inválido", { status: 400 });

    const doc = {
      name: String(payload.name).trim(),
      cep: String(payload.cep).trim(),
      rua: String(payload.rua).trim(),
      titulo: payload.titulo ? String(payload.titulo).trim() : "",
      bairro: String(payload.bairro).trim(),
      cidade: String(payload.cidade).trim(),
      uf: String(payload.uf).trim().toUpperCase(),
      cnpjCpf: String(payload.cnpjCpf).trim(),
      numeroContato: String(payload.numeroContato).trim(),
      tenantRef: tenant._id,
      tenantId: tenant.tenantId,
      tenantName: tenant.name,
      createdAt: new Date().toISOString()
    };

    const { insertedId } = await db.collection("companies").insertOne(doc);
    const created = await db.collection("companies").findOne({ _id: insertedId });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[POST /api/companies] DB ERROR:", e);
    return new NextResponse("Erro ao criar empresa", { status: 500 });
  }
}
