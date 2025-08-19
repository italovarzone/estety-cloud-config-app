export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import { getDb } from "../../../../../../../lib/mongo"; // caminho correto a partir dessa pasta

/* helpers (mesmos do test-db) */
function buildEffectiveUri(baseUri, dbName) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");

  const hasDb = /\/[^/?]+(\?|$)/.test(uri);
  if (!hasDb && dbName) {
    uri = uri.includes("?") ? uri.replace("?", `/${encodeURIComponent(dbName)}?`)
                            : `${uri}/${encodeURIComponent(dbName)}`;
  }
  if (!/[?&]retryWrites=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "retryWrites=true";
  if (!/[?&]w=/.test(uri))           uri += (uri.includes("?") ? "&" : "?") + "w=majority";
  if (!/[?&]appName=/.test(uri))     uri += (uri.includes("?") ? "&" : "?") + "appName=EstetyConfig-UsersEdit";
  return uri;
}
function pickDbNameFromUri(uri, fallback) {
  const m = /mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/.exec(uri);
  return (m && decodeURIComponent(m[1])) || fallback;
}

async function updateUser(req, { params }) {
  const { id, userId } = params;

  // 1) lê body com segurança
  let body = {};
  try { body = await req.json(); } catch {}
  const { tenantId, username, password, city, pix_key, pix_name } = body || {};

  // nada pra atualizar?
  if (
    typeof tenantId !== "string" &&
    typeof username !== "string" &&
    !(typeof password === "string" && password.length) &&
    typeof city !== "string" &&
    typeof pix_key !== "string" &&
    typeof pix_name !== "string"
  ) {
    return NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 });
  }

  try {
    // 2) carrega tenant no banco de configuração
    const cfgDb = await getDb();
    const t = await cfgDb.collection("tenants").findOne(
      { _id: new ObjectId(id) },
      { projection: { dbName: 1, mongoUri: 1 } }
    );
    if (!t) return new NextResponse("not found", { status: 404 });

    // 3) resolve URI do banco do tenant
    const baseUri =
      (t.mongoUri && String(t.mongoUri).trim()) ||
      (process.env.CONFIG_DEFAULT_TENANT_MONGO_URI || "").trim();
    if (!baseUri) {
      return NextResponse.json(
        { ok: false, error: "missing_uri", detail: "Informe tenant.mongoUri ou CONFIG_DEFAULT_TENANT_MONGO_URI" },
        { status: 400 }
      );
    }

    const effectiveUri = buildEffectiveUri(baseUri, t.dbName);
    const client = new MongoClient(effectiveUri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      maxPoolSize: 5,
    });

    try {
      await client.connect();
      const dbName = pickDbNameFromUri(effectiveUri, t.dbName);
      const db = client.db(dbName);
      const col = db.collection("users");

      // 4) filtro por _id (aceita ObjectId ou string, conforme seu dado)
      let filter = { _id: userId };
      if (/^[a-f0-9]{24}$/i.test(userId)) {
        try { filter = { _id: new ObjectId(userId) }; } catch {}
      }

      // 5) monta $set
      const $set = {};
      if (typeof username === "string") $set.username = String(username);
      if (typeof password === "string" && password.length) $set.password = password; // (puro, como no login atual)
      if (typeof tenantId === "string") $set.tenantId = tenantId; // <-- sobrescreve sempre se veio no body
      if (typeof city === "string")     $set["props.city"] = city;
      if (typeof pix_key === "string")  $set["props.pix_key"] = pix_key;
      if (typeof pix_name === "string") $set["props.pix_name"] = pix_name;

      const result = await col.updateOne(filter, { $set });
      if (result.matchedCount === 0) {
        return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
      }

      const user = await col.findOne(filter, { projection: { password: 0 } });
      return NextResponse.json(
        { ok: true, user, target: { db: dbName, collection: "users" } },
        { headers: { "cache-control": "no-store" } }
      );
    } finally {
      try { await client.close(); } catch {}
    }
  } catch (e) {
    const msg = e?.message || String(e);
    const status = /unauthorized|auth/i.test(msg) ? 401
                : /ENOTFOUND|ECONNREFUSED|timeout|ServerSelection/i.test(msg) ? 503
                : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// aceita PATCH e PUT (para não dar 405)
export async function PATCH(req, ctx) { return updateUser(req, ctx); }
export async function PUT(req, ctx)   { return updateUser(req, ctx); }
