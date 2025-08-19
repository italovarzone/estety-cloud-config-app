export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

/* helpers */
function buildEffectiveUri(baseUri: string, dbName?: string) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");

  const hasDb = /\/[^/?]+(\?|$)/.test(uri);
  if (!hasDb && dbName) {
    uri = uri.includes("?") ? uri.replace("?", `/${encodeURIComponent(dbName)}?`)
                            : `${uri}/${encodeURIComponent(dbName)}`;
  }
  if (!/[?&]retryWrites=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "retryWrites=true";
  if (!/[?&]w=/.test(uri))           uri += (uri.includes("?") ? "&" : "?") + "w=majority";
  if (!/[?&]appName=/.test(uri))     uri += (uri.includes("?") ? "&" : "?") + "appName=EstetyConfig-Users";
  return uri;
}
function pickDbNameFromUri(uri: string, fallback?: string) {
  const m = /mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/.exec(uri);
  return (m && decodeURIComponent(m[1])) || fallback;
}

// PUT /api/tenants/:id/users/collection?dbName=...&col=users&forceTenantId=1
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const tenantIdParam = String(params?.id || "").trim();

  try {
    const body = await req.json().catch(() => null);
    const users = Array.isArray(body) ? body : Array.isArray(body?.users) ? body.users : null;
    if (!users) {
      return NextResponse.json({ ok:false, error:"Payload inválido. Envie um array ou { users:[...] }." }, { status:400 });
    }

    const url = new URL(req.url);
    const dbNameOverride = url.searchParams.get("dbName") || undefined;
    const collectionName = url.searchParams.get("col") || "users";
    const forceTenantId  = url.searchParams.get("forceTenantId") === "1";

    // URI SEM Estety Cloud — vem de env
    const baseUri =
      (process.env.CONFIG_DEFAULT_TENANT_MONGO_URI || "").trim() ||
      (process.env.MONGODB_URI || "").trim();
    if (!baseUri) {
      return NextResponse.json({ ok:false, error:"missing_uri", detail:"Defina CONFIG_DEFAULT_TENANT_MONGO_URI ou MONGODB_URI" }, { status:400 });
    }

    const effectiveUri = buildEffectiveUri(baseUri, dbNameOverride);
    const client = new MongoClient(effectiveUri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      maxPoolSize: 5,
    });

    try {
      await client.connect();
      const dbName = pickDbNameFromUri(effectiveUri, dbNameOverride);
      const db = client.db(dbName);

      // mapeia operações
      const ops = users.map((raw: any) => {
        const u: any = { ...raw };
        let _id = u._id;
        delete u._id;

        // normaliza _id
        if (typeof _id === "string" && /^[a-f0-9]{24}$/i.test(_id)) {
          try { _id = new ObjectId(_id); } catch {}
        }
        if (!_id) _id = new ObjectId();

        // carimba tenantId
        if (forceTenantId || !u.tenantId) u.tenantId = tenantIdParam;

        return {
          updateOne: {
            filter: { _id },
            update: { $set: u },
            upsert: true,
          }
        };
      });

      const result = await db.collection(collectionName).bulkWrite(ops, { ordered:false });

      // lê de volta para você validar no ato
      const ids = users.map(u => {
        const id = u._id;
        try { return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : id; } catch { return id; }
      });
      const after = await db.collection(collectionName)
        .find({ _id: { $in: ids } })
        .project({ password: 0 }) // nunca devolve senha
        .toArray();

      return NextResponse.json({
        ok: true,
        target: { db: dbName, collection: collectionName },
        tenantIdApplied: tenantIdParam,
        forceTenantId,
        result: {
          matchedCount:  result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
          upsertedIds:   result.upsertedIds,
        },
        after
      }, { headers: { "cache-control": "no-store" }});
    } finally {
      try { await client.close(); } catch {}
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = /unauthorized|auth/i.test(msg) ? 401
                : /ENOTFOUND|ECONNREFUSED|timeout|ServerSelection/i.test(msg) ? 503
                : 500;
    return NextResponse.json({ ok:false, error: msg }, { status });
  }
}
