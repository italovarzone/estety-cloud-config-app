export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongo";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

function buildEffectiveUri(baseUri, dbName) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");

  // injeta dbName no path se não existir
  const hasDb = /\/[^/?]+(\?|$)/.test(uri);
  if (!hasDb && dbName) {
    // coloca /<dbName> antes da query string
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

export async function GET(req, { params }) {
  const { id } = params;
  const includeUsers = req.nextUrl.searchParams.get("sampleUsers") === "1";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 100);

  try {
    const cfgDb = await getDb();

    // busca o tenant no banco do Config
    const t = await cfgDb.collection("tenants").findOne(
      { _id: new ObjectId(id) },
      { projection: { tenantId: 1, name: 1, slug: 1, dbName: 1, mongoUri: 1, status: 1 } }
    );
    if (!t) return new NextResponse("not found", { status: 404 });

    // define URI efetiva (do tenant ou de fallback)
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

    // conecta e pinga
    const client = new MongoClient(effectiveUri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      // Para Atlas com SRV, TLS já é padrão. Se usar `mongodb://` on-prem com TLS, adicione { tls: true }.
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
          .find({}, { projection: { password: 0 } }) // oculte senha por padrão
          .limit(limit)
          .toArray();
      }

      return NextResponse.json(
        {
          ok: true,
          tenant: { tenantId: t.tenantId, name: t.name, slug: t.slug, status: t.status },
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
    // normaliza mensagem de erros de rede/TLS
    const msg = e?.message || String(e);
    const status = /unauthorized|auth/i.test(msg) ? 401
                : /ENOTFOUND|ECONNREFUSED|timeout|ServerSelection/i.test(msg) ? 503
                : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
