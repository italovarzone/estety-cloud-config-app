export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongo";

function makeSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(req, { params }) {
  const { id } = params;
  const db = await getDb();
  const company = await db.collection("companies").findOne({ _id: new ObjectId(id) });
  if (!company) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(req, { params }) {
  const { id } = params;
  const payload = await req.json();
  const db = await getDb();
  const update: Record<string, any> = {};

  // campos permitidos
  const allowed = [
    "name","slug","cep","rua","titulo","bairro","cidade","uf","cnpjCpf","numeroContato","tenantRef"
  ];
  for (const k of allowed) if (payload[k] !== undefined) update[k] = payload[k];

  // recriar slug se nome mudou
  if (update.name && !payload.slug) {
    let slug = makeSlug(update.name);
    let uniqueSlug = slug;
    let counter = 1;
    while (await db.collection("companies").findOne({ slug: uniqueSlug, _id: { $ne: new ObjectId(id) } })) {
      uniqueSlug = `${slug}-${counter++}`;
    }
    update.slug = uniqueSlug;
  }

  // valida slug manual
  if (payload.slug) {
    const existing = await db.collection("companies").findOne({
      slug: payload.slug,
      _id: { $ne: new ObjectId(id) },
    });
    if (existing) return new NextResponse("Slug já existe", { status: 400 });
    update.slug = makeSlug(payload.slug);
  }

  // atualiza tenant se mudou
  if (update.tenantRef) {
    const tenant = await db.collection("tenants").findOne({ _id: new ObjectId(update.tenantRef) });
    if (!tenant) return new NextResponse("Tenant inválido", { status: 400 });
    update.tenantRef = tenant._id;
    update.tenantId = tenant.tenantId;
    update.tenantName = tenant.name;
  }

  await db.collection("companies").updateOne({ _id: new ObjectId(id) }, { $set: update });
  const updated = await db.collection("companies").findOne({ _id: new ObjectId(id) });
  return NextResponse.json(updated);
}

export async function DELETE(req, { params }) {
  const { id } = params;
  const db = await getDb();
  const r = await db.collection("companies").deleteOne({ _id: new ObjectId(id) });
  if (!r.deletedCount) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ ok: true });
}
