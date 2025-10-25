// src/app/api/users-estetycloud/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "../../../lib/mongo";

const CONFIG_KEY = process.env.CONFIG_API_KEY || "";

async function ensureApiKey(req) {
  try {
    const headers = Object.fromEntries(req.headers.entries());
    const given =
      headers["x-config-api-key"] ||
      headers["X-Config-Api-Key"] ||
      (headers["authorization"] || headers["Authorization"] || "")
        .replace(/^Bearer\s+/i, "");

    if (!process.env.CONFIG_API_KEY) {
      console.warn("[ensureApiKey] ⚠️ CONFIG_API_KEY não configurada!");
      return NextResponse.json({ error: "config_missing" }, { status: 500 });
    }

    if (!given || given.trim() !== process.env.CONFIG_API_KEY.trim()) {
      console.error("[ensureApiKey] ❌ Chave incorreta ou ausente!");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    
    return null;
  } catch (err) {
    console.error("[ensureApiKey] erro ao validar:", err);
    return NextResponse.json(
      { error: "internal_error", detail: String(err) },
      { status: 500 }
    );
  }
}

// ============================
// 🔹 GET /api/users-estetycloud
// ============================
export async function GET(req) {
  const unauthorized = await ensureApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const db = await getDb();

    // 🔸 Busca todos os usuários
    const users = await db
      .collection("users_estetycloud")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // 🔸 Busca todas as empresas (companies) com slug e tenantId
    const companies = await db
      .collection("companies")
      .find({}, { projection: { tenantId: 1, slug: 1, name: 1 } })
      .toArray();

    // 🔸 Mapeia cada usuário para incluir o slug correspondente de cada tenant
    const enriched = users.map((u) => {
      const tenantObjects = Array.isArray(u.tenantIds)
        ? u.tenantIds.map((tId) => {
            const company = companies.find((c) => c.tenantId === tId);
            return {
              tenantId: tId,
              slug: company?.slug || null,
              companyName: company?.name || null,
            };
          })
        : [];

      return {
        ...u,
        tenants: tenantObjects,
      };
    });

    return NextResponse.json(enriched, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    console.error("[GET /api/users-estetycloud] ERROR:", e);
    return NextResponse.json(
      { error: "db_error", detail: String(e) },
      { status: 500 }
    );
  }
}

// ============================
// 🔹 POST /api/users-estetycloud
// ============================
export async function POST(req) {
  const unauthorized = await ensureApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const payload = await req.json();
    for (const r of ["email", "password", "tenantIds", "type"]) {
      if (payload[r] == null) {
        return new NextResponse(`Campo obrigatório: ${r}`, { status: 400 });
      }
    }

    const doc = {
      userId: randomUUID(),
      email: String(payload.email).trim().toLowerCase(),
      password: String(payload.password).trim(),
      tenantIds: Array.isArray(payload.tenantIds) ? payload.tenantIds : [],
      directives: Array.isArray(payload.directives) ? payload.directives : [],
      type: payload.type === 1 ? 1 : 0,
      // 🔹 Campos PIX
      pix_key: payload.pix_key ? String(payload.pix_key).trim() : undefined,
      pix_name: payload.pix_name ? String(payload.pix_name).trim() : undefined,
      city: payload.city ? String(payload.city).trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const db = await getDb();
    await db.collection("users_estetycloud").createIndexes([
      { key: { userId: 1 }, name: "uniq_userId", unique: true },
      { key: { email: 1 }, name: "uniq_email", unique: true },
    ]);

    const exists = await db.collection("users_estetycloud").findOne({ email: doc.email });
    if (exists) return new NextResponse("E-mail já cadastrado", { status: 409 });

    const { insertedId } = await db.collection("users_estetycloud").insertOne(doc);
    const created = await db
      .collection("users_estetycloud")
      .findOne({ _id: insertedId }, { projection: { password: 0 } });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[POST /api/users-estetycloud] ERROR:", e);
    return new NextResponse("Erro ao criar usuário", { status: 500 });
  }
}
