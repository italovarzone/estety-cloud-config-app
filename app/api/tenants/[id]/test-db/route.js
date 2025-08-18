export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongo";

/* ------------------------- helpers ------------------------- */
function buildEffectiveUri(baseUri, dbName) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");

  // injeta dbName no path se não existir
  const hasDb = /\/[^/?]+(\?|$)/.test(uri);
  if (!hasDb && dbName) {
    if (uri.includes("?")) {
      uri = uri.replace("?", `/${encodeURIComponent(dbName)}?`);
    } else {
      uri = `${uri}/${encodeURIComponent(dbName)}`;
    }
  }

  // parâmetros padrão
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

/**
 * GET /api/tenants/:id/test-db?sampleUsers=1&limit=20
 * :id = _id do documento do tenant (ObjectId) no banco de configuração.
 */
export async function GET(req, { params }) {
  const { id } = params;

  // query params
  const url = req.nextUrl;
  const includeUsers = url.searchParams.get("sampleUsers") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 100);

  try {
    // 1) abre o banco de configuração e carrega o tenant
    const cfgDb = await getDb();
    const t = await cfgDb.collection("tenants").findOne(
      { _id: new ObjectId(id) },
      { projection: { tenantId: 1, name: 1, slug: 1, dbName: 1, mongoUri: 1, status: 1 } }
    );
    if (!t) {
      return new NextResponse("not found", { status: 404 });
    }

    // 2) resolve a URI efetiva do banco do tenant
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
    const started = Date.now();

    // 3) conecta e pinga
    const client = new MongoClient(effectiveUri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      maxPoolSize: 5,
    });

    try {
      await client.connect();
      const dbName = pickDbNameFromUri(effectiveUri, t.dbName);
      const db = client.db(dbName);

      await db.command({ ping: 1 });
      const rttMs = Date.now() - started;

      let usersSample = null;
      if (includeUsers) {
        usersSample = await db
          .collection("users")
          .find({}, { projection: { password: 0 } }) // nunca retornar senha
          .limit(limit)
          .toArray();
      }

      return NextResponse.json(
        {
          ok: true,
          tenant: {
            tenantId: t.tenantId,
            name: t.name,
            slug: t.slug,
            status: t.status,
          },
          dbName,
          uriKind: effectiveUri.startsWith("mongodb+srv://") ? "srv" : "standard",
          pingMs: rttMs,
          usersSample,
        },
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
