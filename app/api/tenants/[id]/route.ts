export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";

function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "").slice(0, 60);
}

// GET /api/tenants
export async function GET() {
  try {
    const db = await getDb();
    const list = await db.collection("tenants").find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tenants] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}

// POST /api/tenants
export async function POST(req) {
  try {
    const payload = await req.json();
    for (const r of ["name", "dbName"]) {
      if (!payload[r]) return new NextResponse(`Campo obrigatório: ${r}`, { status: 400 });
    }
    const tenantId = randomUUID();
    const name = String(payload.name).trim();
    const baseSlug = payload.slug ? String(payload.slug).trim() : slugify(name);

    const doc = {
      tenantId,
      name,
      slug: baseSlug || null,
      dbName: String(payload.dbName).trim(),
      mongoUri: payload.mongoUri ? String(payload.mongoUri).trim() : null,
      status: payload.status === "inactive" ? "inactive" : "active",
      createdAt: new Date().toISOString(),
    };

    const db = await getDb();
    await db.collection("tenants").createIndexes([
      { key: { tenantId: 1 }, name: "uniq_tenantId", unique: true },
      { key: { slug: 1 }, name: "uniq_slug", unique: true, partialFilterExpression: { slug: { $type: "string" } } },
    ]);

    const or: any[] = [{ tenantId: doc.tenantId }];
    if (doc.slug) or.push({ slug: doc.slug });

    const exists = await db.collection("tenants").findOne({ $or: or });
    if (exists) return new NextResponse("tenantId ou slug já existe", { status: 409 });

    const { insertedId } = await db.collection("tenants").insertOne(doc);
    const created = await db.collection("tenants").findOne({ _id: insertedId });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tenants] ERROR:", e);
    return new NextResponse("Erro ao criar tenant", { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const payload = await req.json();
    const db = await getDb();

    const _id = new ObjectId(params.id);
    const curr = await db.collection("tenants").findOne({ _id });
    if (!curr) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // campos editáveis
    const name = payload.name != null ? String(payload.name).trim() : curr.name;
    const status = payload.status === "inactive" ? "inactive" : "active";
    const dbName = payload.dbName != null ? String(payload.dbName).trim() : curr.dbName;
    const mongoUri = payload.mongoUri != null ? (payload.mongoUri ? String(payload.mongoUri).trim() : null) : (curr.mongoUri ?? null);

    // slug: se veio string vazia => zera; se não veio => mantém; se veio valor => normaliza
    let slug: string | null = curr.slug ?? null;
    if (payload.slug !== undefined) {
      const raw = String(payload.slug || "").trim();
      slug = raw ? slugify(raw) : null;
    }

    // checa unicidade do slug (se houver)
    if (slug) {
      const exists = await db.collection("tenants").findOne({ slug, _id: { $ne: _id } });
      if (exists) {
        return NextResponse.json({ error: "slug_conflict", message: "Slug já existe." }, { status: 409 });
      }
    }

    const upd = {
      name, status, dbName, mongoUri, slug
    };

    await db.collection("tenants").updateOne({ _id }, { $set: upd });

    const updated = await db.collection("tenants").findOne({ _id });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/tenants/:id] ERROR:", e);
    return NextResponse.json({ error: "db_error", detail: String(e) }, { status: 500 });
  }
}
