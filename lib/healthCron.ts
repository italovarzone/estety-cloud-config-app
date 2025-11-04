import { getDb } from "./mongo";
import { MongoClient, ServerApiVersion } from "mongodb";
import { sendMail } from "./mailer";

let started = false;

function buildEffectiveUri(baseUri: string, dbName?: string | null) {
  let uri = String(baseUri || "").trim();
  if (!uri) throw new Error("mongoUri ausente");
  const hasDb = /\/[^/?]+(\?|$)/.test(uri);
  if (!hasDb && dbName) {
    uri = uri.includes("?") ? uri.replace("?", `/${encodeURIComponent(dbName)}?`) : `${uri}/${encodeURIComponent(dbName)}`;
  }
  if (!/[?&]retryWrites=/.test(uri)) uri += (uri.includes("?") ? "&" : "?") + "retryWrites=true";
  if (!/[?&]w=/.test(uri))           uri += (uri.includes("?") ? "&" : "?") + "w=majority";
  if (!/[?&]appName=/.test(uri))     uri += (uri.includes("?") ? "&" : "?") + "appName=EstetyConfig-Health";
  return uri;
}

async function pingDb(baseUri: string, dbName?: string | null) {
  const effectiveUri = buildEffectiveUri(baseUri, dbName);
  const started = Date.now();
  const client = new MongoClient(effectiveUri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    maxPoolSize: 3,
  });
  try {
    await client.connect();
    const db = client.db();
    await db.command({ ping: 1 });
    return { ok: true, pingMs: Date.now() - started } as const;
  } finally {
    try { await client.close(); } catch {}
  }
}

async function checkLsp() {
  try {
    const res = await fetch(process.env.LINK_FRONTEND, { method: "HEAD", redirect: "follow" });
    return { ok: res.status < 400, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  }
}

export async function runHealthOnce() {
  const db = await getDb();
  const tenants = await db.collection("tenants").find({}, { projection: { name: 1, slug: 1, tenantId: 1, mongoUri: 1, dbName: 1 } }).toArray();

  const issues: string[] = [];

  const lsp = await checkLsp();
  if (!lsp.ok) issues.push(`Site lsp-estety.cloud indisponível (status ${lsp.status}).`);

  for (const t of tenants) {
    const baseUri = (t.mongoUri && String(t.mongoUri).trim()) || (process.env.CONFIG_DEFAULT_TENANT_MONGO_URI || "").trim();
    if (!baseUri) {
      issues.push(`Tenant ${t.name || t.slug || t.tenantId}: mongoUri ausente.`);
      continue;
    }
    try {
      const r = await pingDb(baseUri, t.dbName);
      if (!r.ok) issues.push(`Tenant ${t.name || t.slug || t.tenantId}: ping DB falhou.`);
    } catch (e: any) {
      issues.push(`Tenant ${t.name || t.slug || t.tenantId}: erro DB (${String(e?.message || e)}).`);
    }
  }

  if (issues.length) {
    const title = "Alerta de Saúde — Estety Cloud";
    // envia e-mail para operação (Web Push removido)
    const html = `
      <h2>${title}</h2>
      <p>Os seguintes problemas foram detectados:</p>
      <ul>
        ${issues.map((i) => `<li>${i}</li>`).join("")}
      </ul>
      <p>Verifique os serviços afetados.</p>
    `;
    try { await sendMail("italo.varzah@gmail.com", title, html, "Italo"); } catch {}
  }
}

export function initHealthCron() {
  if (started) return;
  started = true;
  // executa logo ao subir e depois a cada 10 minutos
  runHealthOnce().catch(() => {});
  setInterval(() => runHealthOnce().catch(() => {}), 10 * 60 * 1000);
}
