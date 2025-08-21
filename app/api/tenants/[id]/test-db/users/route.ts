export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";
import { getDb } from "../../../../../../lib/mongo";

/* helpers (copiados dos teus arquivos) */
function buildEffectiveUri(baseUri: string, dbName: string) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");
  const hasDb = /\/[^/?]+(\?|$)/.test(uri);
  if (!hasDb && dbName) {
    uri = uri.includes("?")
      ? uri.replace("?", `/${encodeURIComponent(dbName)}?`)
      : `${uri}/${encodeURIComponent(dbName)}`;
  }
  if (!/[?&]retryWrites=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "retryWrites=true";
  if (!/[?&]w=/.test(uri))           uri += (uri.includes("?") ? "&" : "?") + "w=majority";
  if (!/[?&]appName=/.test(uri))     uri += (uri.includes("?") ? "&" : "?") + "appName=EstetyConfig-UsersCreate";
  return uri;
}

function pickDbNameFromUri(uri: string, fallback?: string | null) {
  const m = /mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/.exec(uri);
  return (m && decodeURIComponent(m[1])) || (fallback || "");
}

function sanitizeDbName(name: string, fallback: string) {
  if (!name) return fallback;
  const clean = name.replace(/^\//, "").trim();
  if (/[.\s]/.test(clean)) return fallback;
  return clean || fallback;
}

async function connectTenantDbByCfgId(cfgId: string) {
  const cfgDb = await getDb();
  const cfg = await cfgDb.collection("tenants").findOne({ _id: new ObjectId(cfgId) });
  if (!cfg) throw new Error("tenant config não encontrado");

  const dbName = String(cfg.dbName || "").trim();
  if (!dbName) throw new Error("dbName ausente no cfg do tenant");

  const baseUri = String(cfg.mongoUri || "").trim();
  if (!baseUri) throw new Error("mongoUri ausente no cfg do tenant");

  const uri = buildEffectiveUri(baseUri, dbName);
  const client = new MongoClient(uri);
  await client.connect();
  const rawDbName = pickDbNameFromUri(uri, dbName) || dbName;
  const realDbName = sanitizeDbName(rawDbName, dbName);
  const tenantDb = client.db(realDbName);
  return { client, tenantDb, cfg };
}

// POST /api/tenants/:id/test-db/users
export async function POST(req: Request, ctx: { params: { id: string } }) {
  let client: MongoClient | null = null;
  try {
    const { id } = ctx.params;
    const payload = await req.json();

    const username = String(payload.username || "").trim();
    const password = String(payload.password || "").trim();
    const tenantId = String(payload.tenantId || "").trim();
    const city = payload.city ? String(payload.city) : "";
    const pix_key = payload.pix_key ? String(payload.pix_key) : "";
    const pix_name = payload.pix_name ? String(payload.pix_name) : "";

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "username e password são obrigatórios" }, { status: 400 });
    }

    const conn = await connectTenantDbByCfgId(id);
    client = conn.client;
    const { tenantDb, cfg } = conn;

    // regra: só 1 usuário por tenant
    const usersCol = tenantDb.collection("users");
    const total = await usersCol.countDocuments({});
    if (total >= 1) {
      return NextResponse.json({ ok: false, error: "Já existe um usuário para este tenant" }, { status: 409 });
    }

    const enforcedTenantId = tenantId || cfg.tenantId || "";
    const doc = {
      username,
      password, // (em claro, como está no teu PATCH/LOGIN atuais)
      tenantId: enforcedTenantId,
      props: { city, pix_key, pix_name },
      createdAt: new Date().toISOString(),
    };

    const { insertedId } = await usersCol.insertOne(doc);
    const created = await usersCol.findOne({ _id: insertedId }, { projection: { password: 0 } });

    return NextResponse.json({ ok: true, user: created }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    console.error("[POST /users] ERROR:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
