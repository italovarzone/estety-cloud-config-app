export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongo";

function buildEffectiveUri(baseUri: string, dbName?: string | null) {
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
  if (!/[?&]appName=/.test(uri))     uri += (uri.includes("?") ? "&" : "?") + "appName=EstetyConfig-Logs";
  return uri;
}

function pickDbNameFromUri(uri: string, fallback?: string | null) {
  try {
    const u = new URL(uri);
    const name = u.pathname.replace(/^\//, "");
    if (name) return decodeURIComponent(name);
  } catch {
    const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return (fallback || "");
}

function sanitizeDbName(name: string, fallback: string) {
  if (!name) return fallback;
  const clean = name.replace(/^\//, "").trim();
  if (/[.\s]/.test(clean)) return fallback;
  return clean || fallback;
}

/**
 * GET /api/tenants/:id/logs?job=&channel=&success=true|false&from=ISO&to=ISO&page=1&limit=10
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const url = new URL(req.url);

  const job = (url.searchParams.get("job") || "").trim();
  const channel = (url.searchParams.get("channel") || "").trim(); // 'webpush'|'email'
  const successRaw = url.searchParams.get("success");
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
  const limitRaw = parseInt(url.searchParams.get("limit") || "10", 10);
  const limit = Math.min(Math.max(limitRaw || 10, 1), 100);

  try {
    const cfgDb = await getDb();
    const t = await cfgDb.collection("tenants").findOne(
      { _id: new ObjectId(id) },
      { projection: { tenantId: 1, name: 1, slug: 1, dbName: 1, mongoUri: 1, status: 1 } }
    );
    if (!t) return new NextResponse("not found", { status: 404 });

    const baseUri = (t.mongoUri && String(t.mongoUri).trim()) || (process.env.CONFIG_DEFAULT_TENANT_MONGO_URI || "").trim();
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
      const rawDbName = pickDbNameFromUri(effectiveUri, t.dbName);
      const dbName = sanitizeDbName(rawDbName, t.dbName);
      const db = client.db(dbName);

      const query: any = {};
      if (job) query.job = job;
      if (channel) query.channel = channel;
      if (successRaw === 'true') query.success = true;
      if (successRaw === 'false') query.success = false;

      if (fromRaw || toRaw) {
        const range: any = {};
        if (fromRaw) {
          const d = new Date(fromRaw);
          if (!isNaN(d.getTime())) range.$gte = d;
        }
        if (toRaw) {
          const d = new Date(toRaw);
          if (!isNaN(d.getTime())) range.$lte = d;
        }
        if (Object.keys(range).length) query.createdAt = range;
      }

      const coll = db.collection("logs_envio_notificacoes");

      const total = await coll.countDocuments(query).catch(() => 0);
      const cursor = coll
        .find(query)
        .project({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      const items = await cursor.toArray();

      return NextResponse.json({ ok: true, page, pageSize: limit, total, items }, { headers: { "cache-control": "no-store" } });
    } finally {
      try { await client.close(); } catch {}
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = /unauthorized|auth/i.test(msg) ? 401
                : /ENOTFOUND|ECONNREFUSED|timeout|ServerSelection/i.test(msg) ? 503
                : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
