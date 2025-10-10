export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";
import { getDb } from "../../../../../../../lib/mongo";

function pickDbNameFromUri(uri: string, fallback?: string | null) {
  const parts = uri.split("/");
  const last = parts[parts.length - 1] || "";
  const dbCandidate = last.split("?")[0].trim();
  if (!dbCandidate) return fallback || "";
  // remove caracteres inválidos
  return dbCandidate.replace(/[.$\/\0]/g, "_");
}


function ensureDbInUri(baseUri: string, dbName: string) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");

  const hasDb = /\/[^/?]+(?:[/?]|$)/.test(uri);
  if (!hasDb && dbName) {
    uri = uri.includes("?")
      ? uri.replace("?", `/${encodeURIComponent(dbName)}?`)
      : `${uri}/${encodeURIComponent(dbName)}`;
  }
  if (!/[?&]retryWrites=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "retryWrites=true";
  if (!/[?&]w=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "w=majority";
  if (!/[?&]appName=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "appName=EstetyConfig-UsersCreate";
  return uri;
}

async function connectTenantDbByCfgId(cfgId: string) {
  // lê o tenant (documento de configuração)
  const cfgDb = await getDb();
  const cfg = await cfgDb.collection("tenants").findOne({ _id: new ObjectId(cfgId) });
  if (!cfg) throw new Error("tenant config não encontrado");

  const dbName = String(cfg.dbName || "").trim();
  if (!dbName) throw new Error("dbName ausente no cfg do tenant");

  // usa mongoUri específico do tenant OU herda da string de conexão padrão (se você tiver)
  // aqui assumo que mongoUri no cfg é obrigatório para isolar base por tenant
  const baseUri = String(cfg.mongoUri || "").trim();
  if (!baseUri) throw new Error("mongoUri ausente no cfg do tenant");

  const uri = ensureDbInUri(baseUri, dbName);
  const client = new MongoClient(uri);
  await client.connect();
const realDbName = (pickDbNameFromUri(uri, dbName) || dbName).replace(/[.$\/\0]/g, "_");
const tenantDb = client.db(realDbName);
  return { client, tenantDb, cfg };
}
/* reaproveita os mesmos helpers do #1 (pode copiar/colar ou extrair p/ util) */
// ... buildEffectiveUri, pickDbNameFromUri, sanitizeDbName, connectTenantDbByCfgId ...

async function updateUser(req: Request, { params }: { params: { id: string; userId: string } }) {
  const { id, userId } = params;

  type UserBody = {
    tenantId?: string;
    username?: string;
    password?: string;
    city?: string;
    pix_key?: string;
    pix_name?: string;
    directives?: string[];
  };

  let body: UserBody = {};
  try { body = await req.json(); } catch {}

  const { tenantId, username, password, city, pix_key, pix_name, directives } = body || {};

  const hasUpdate =
    typeof tenantId === "string" ||
    typeof username === "string" ||
    (typeof password === "string" && password.length) ||
    typeof city === "string" ||
    typeof pix_key === "string" ||
    typeof pix_name === "string" ||
    Array.isArray(directives);

  if (!hasUpdate) {
    return NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 });
  }

  let client: MongoClient | null = null;
  try {
    const conn = await connectTenantDbByCfgId(id);
    client = conn.client;
    const db = conn.tenantDb;
    const col = db.collection("users");

    let filter: any = { _id: userId };
    if (/^[a-f0-9]{24}$/i.test(userId)) {
      try { filter = { _id: new ObjectId(userId) }; } catch {}
    }

    const $set: Record<string, any> = {};
    if (typeof username === "string") $set.username = String(username);
    if (typeof password === "string" && password.length) $set.password = password;
    if (typeof tenantId === "string") $set.tenantId = tenantId;
    if (typeof city === "string")     $set["props.city"] = city;
    if (typeof pix_key === "string")  $set["props.pix_key"] = pix_key;
    if (typeof pix_name === "string") $set["props.pix_name"] = pix_name;
    if (Array.isArray(directives))    $set.directives = directives.filter((d) => typeof d === "string" && d.trim());

    const result = await col.updateOne(filter, { $set });
    if (result.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }

    const user = await col.findOne(filter, { projection: { password: 0 } });
    return NextResponse.json({ ok: true, user }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

export async function PATCH(req: Request, ctx: any) {
  return updateUser(req, ctx);
}
