export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

/* ------------------------- helpers ------------------------- */
function buildEffectiveUri(baseUri, dbName) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");

  const hasDb = /\/[^/?]+(\?|$)/.test(uri);
  if (!hasDb && dbName) {
    if (uri.includes("?")) uri = uri.replace("?", `/${encodeURIComponent(dbName)}?`);
    else uri = `${uri}/${encodeURIComponent(dbName)}`;
  }
  if (!/[?&]retryWrites=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "retryWrites=true";
  if (!/[?&]w=/.test(uri))           uri += (uri.includes("?") ? "&" : "?") + "w=majority";
  if (!/[?&]appName=/.test(uri))     uri += (uri.includes("?") ? "&" : "?") + "appName=EstetyConfig-Tester";
  return uri;
}

function pickDbNameFromUri(uri, fallback) {
  const m = /mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/.exec(uri);
  return (m && decodeURIComponent(m[1])) || fallback;
}
/* ----------------------------------------------------------- */

// PUT /api/tenants/:id/users/collection
export async function PUT(req) {
  try {
    // aceita [ ... ] ou { users: [ ... ] }
    const body = await req.json().catch(() => null);
    const users = Array.isArray(body) ? body : Array.isArray(body?.users) ? body.users : null;
    if (!users) {
      return NextResponse.json(
        { ok: false, error: "Payload inválido. Envie um array ou { users: [...] }." },
        { status: 400 }
      );
    }

    // usa uma URI padrão sem validar tenant
    const baseUri =
      (process.env.CONFIG_DEFAULT_TENANT_MONGO_URI || "").trim() ||
      (process.env.MONGODB_URI || "").trim();

    if (!baseUri) {
      return NextResponse.json(
        { ok: false, error: "missing_uri", detail: "Defina CONFIG_DEFAULT_TENANT_MONGO_URI ou MONGODB_URI" },
        { status: 400 }
      );
    }

    // opcional: ?dbName=meu-db
    const url = new URL(req.url);
    const dbNameOverride = url.searchParams.get("dbName") || undefined;

    const effectiveUri = buildEffectiveUri(baseUri, dbNameOverride);
    const client = new MongoClient(effectiveUri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      maxPoolSize: 5,
    });

    try {
      await client.connect();
      const dbName = pickDbNameFromUri(effectiveUri, dbNameOverride);
      const db = client.db(dbName);

      // bulkWrite sem validação/injeção
      const ops = users.map((raw) => {
        const u = { ...raw };
        let _id = u._id;
        delete u._id;

        if (typeof _id === "string" && /^[a-f0-9]{24}$/i.test(_id)) {
          try { _id = new ObjectId(_id); } catch {}
        }
        if (!_id) _id = new ObjectId();

        return { updateOne: { filter: { _id }, update: { $set: u }, upsert: true } };
      });

      const result = await db.collection("users").bulkWrite(ops, { ordered: false });


      return NextResponse.json(
        { ok: true, result },
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
