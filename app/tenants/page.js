"use client";
import { useEffect, useState } from "react";

// pega o _id mesmo que venha como {$oid:"..."}
const oid = (x) => (x && typeof x === "object" && "$oid" in x ? x.$oid : x);

function randomHex24() {
  try {
    const b = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return (Date.now().toString(16) + Math.random().toString(16).slice(2, 14)).slice(0, 24);
  }
}

export default function TenantsPage() {
  // form
  const [form, setForm] = useState({
    tenantId: crypto?.randomUUID?.() || "",
    name: "",
    slug: "",
    dbName: "",
    mongoUri: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // lista tenants
  const [items, setItems] = useState([]);
  const [loadingId, setLoadingId] = useState(null);

  // modal resultado
  const [modalOpen, setModalOpen] = useState(false);
  const [verifyData, setVerifyData] = useState(null);

  // modal editor JSON
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorJson, setEditorJson] = useState("[]");
  const [editorMsg, setEditorMsg] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const res = await fetch("/api/tenants", { cache: "no-store" });
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaveMsg(null);
    if (!form.tenantId || !form.name || !form.dbName) {
      setSaveMsg({ type: "error", text: "Preencha tenantId, name e dbName." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: String(form.tenantId).trim(),
          name: String(form.name).trim(),
          slug: form.slug || null,
          dbName: String(form.dbName).trim(),
          mongoUri: form.mongoUri || null,
          status: form.status,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setSaveMsg({ type: "error", text: txt || `Falha ao salvar (${res.status})` });
      } else {
        setSaveMsg({ type: "ok", text: "Tenant criado com sucesso." });
        setForm({
          tenantId: crypto?.randomUUID?.() || "",
          name: "",
          slug: "",
          dbName: "",
          mongoUri: "",
          status: "active",
        });
        await load();
      }
    } catch (err) {
      setSaveMsg({ type: "error", text: String(err) });
    } finally {
      setSaving(false);
    }
  }

  function genGuid() {
    try { setForm((f) => ({ ...f, tenantId: crypto.randomUUID() })); }
    catch {
      const id = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2,10)}`;
      setForm((f) => ({ ...f, tenantId: id }));
    }
  }

  // -------- VERIFICAR (usa GET /test-db) --------
  function normalizeVerifyResponse(status, data) {
    const users = Array.isArray(data?.usersSample) ? data.usersSample : [];
    return {
      ok: !!data?.ok || (status >= 200 && status < 300),
      status,
      tenant: data?.tenant,
      dbName: data?.dbName,
      uriKind: data?.uriKind,
      pingMS: data?.pingMs ?? data?.pingMS ?? "-",
      users,
      _raw: data,
    };
  }

  async function handleVerify(idRaw) {
    const id = oid(idRaw); // aqui é o _id (ObjectId) do doc de config
    setLoadingId(id);
    setVerifyData(null);
    try {
      // 🔴 VOLTA para o endpoint correto de leitura:
      const res = await fetch(`/api/tenants/${id}/test-db?sampleUsers=1&limit=20`, { cache: "no-store" });
      const raw = await res.json();
      const norm = normalizeVerifyResponse(res.status, raw);
      setVerifyData(norm);
      setModalOpen(true);
    } catch (e) {
      setVerifyData({ ok: false, status: "ERR", _raw: { error: String(e) }, users: [] });
      setModalOpen(true);
    } finally {
      setLoadingId(null);
    }
  }

  // -------- botões acima da tabela --------
  function openEditCollection() {
    if (!verifyData) return;
    setEditorJson(JSON.stringify(verifyData.users || [], null, 2));
    setEditorMsg(null);
    setEditorOpen(true);
  }
  function openInsertRecord() {
    if (!verifyData) return;
    const tenantId = verifyData.tenant?.tenantId || "";
    const next = [
      ...(verifyData.users || []),
      { _id: randomHex24(), username: "novo.usuario", password: "senha123", tenantId },
    ];
    setEditorJson(JSON.stringify(next, null, 2));
    setEditorMsg(null);
    setEditorOpen(true);
  }

  async function handleSaveCollection() {
    if (!verifyData?.tenant?.tenantId) {
      setEditorMsg({ type: "error", text: "tenantId não encontrado no resultado." });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(editorJson);
      if (!Array.isArray(payload)) throw new Error();
    } catch {
      setEditorMsg({ type: "error", text: "O JSON deve ser um array de usuários." });
      return;
    }

    setEditorLoading(true);
    setEditorMsg({ type: "ok", text: "Salvando…" });
    try {
      // aqui sim usamos o PUT na rota nova
      const res = await fetch(`/api/tenants/${verifyData.tenant.tenantId}/users/collection`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ users: payload }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setEditorMsg({ type: "error", text: txt || `Falha ao salvar (${res.status})` });
      } else {
        setEditorMsg({ type: "ok", text: "Coleção salva com sucesso." });
        setVerifyData((curr) => (curr ? { ...curr, users: payload } : curr));
      }
    } catch (e) {
      setEditorMsg({ type: "error", text: String(e) });
    } finally {
      setEditorLoading(false);
    }
  }

  function copyRawJSON() {
    if (verifyData?._raw) navigator.clipboard.writeText(JSON.stringify(verifyData._raw, null, 2));
  }

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>

      {/* --- NOVO TENANT --- */}
      <form onSubmit={handleCreate} className="rounded-2xl border p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Novo Tenant</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">tenantId *</label>
            <div className="flex gap-2">
              <input className="input w-full" value={form.tenantId}
                     onChange={(e) => setForm({ ...form, tenantId: e.target.value })} disabled required />
            </div>
          </div>
          <div><label className="block text-sm mb-1">name *</label>
            <input className="input w-full" value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div><label className="block text-sm mb-1">slug</label>
            <input className="input w-full" value={form.slug}
                   onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div><label className="block text-sm mb-1">dbName *</label>
            <input className="input w-full" value={form.dbName}
                   onChange={(e) => setForm({ ...form, dbName: e.target.value })} required />
          </div>
          <div className="md:col-span-2"><label className="block text-sm mb-1">mongoUri</label>
            <input className="input w-full" value={form.mongoUri}
                   onChange={(e) => setForm({ ...form, mongoUri: e.target.value })} />
          </div>
          <div><label className="block text-sm mb-1">status</label>
            <select className="input w-full" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {saveMsg && <span className={saveMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}>
            {saveMsg.text}
          </span>}
        </div>
      </form>

      {/* --- LISTA TENANTS --- */}
      <div className="overflow-x-auto border rounded-2xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50"><tr>
            <th className="px-4 py-3 text-left">tenantId</th>
            <th className="px-4 py-3 text-left">name</th>
            <th className="px-4 py-3 text-left">dbName</th>
            <th className="px-4 py-3 text-left">status</th>
            <th className="px-4 py-3 text-right">ações</th>
          </tr></thead>
          <tbody>
          {items.map((t) => {
            const id = oid(t._id);
            return (
              <tr key={id} className="border-t">
                <td className="px-4 py-3">{t.tenantId}</td>
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3">{t.dbName}</td>
                <td className="px-4 py-3">{t.status}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleVerify(id)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                          disabled={loadingId === id}>
                    {loadingId === id ? "Verificando..." : "Verificar conexão"}
                  </button>
                </td>
              </tr>
            );
          })}
          {!items.length && (
            <tr><td className="px-4 py-6 text-zinc-500" colSpan={5}>Sem tenants.</td></tr>
          )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL RESULTADO --- */}
      {modalOpen && verifyData && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center z-50">
          <div className="bg-white w-[min(980px,96vw)] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Resultado da verificação</h2>
              <div className="flex items-center gap-2">
                <button onClick={copyRawJSON} className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50">Copiar JSON</button>
                <button onClick={() => setModalOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm rounded-xl border p-3 bg-zinc-50">
              <div>
                <div><b>Status:</b> {verifyData.ok ? <span className="text-emerald-700">OK</span> : <span className="text-red-600">Falha</span>} <span className="text-zinc-600">({verifyData.status})</span></div>
                <div className="mt-1"><b>Tenant:</b> {verifyData.tenant?.name || "-"} {verifyData.tenant?.tenantId ? <span className="text-zinc-600">— {verifyData.tenant.tenantId}{verifyData.tenant.slug ? ` (${verifyData.tenant.slug})` : ""}</span> : null}</div>
                <div className="mt-1"><b>Tenant status:</b> {verifyData.tenant?.status || "-"}</div>
              </div>
              <div>
                <div><b>DB:</b> {verifyData.dbName || "-"}</div>
                <div className="mt-1"><b>URI:</b> {verifyData.uriKind || "-"}</div>
                <div className="mt-1"><b>Ping:</b> {verifyData.pingMS ?? "-"}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm font-medium">Usuários retornados ({verifyData.users?.length || 0})</div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50" onClick={openEditCollection}>Editar coleção</button>
                <button className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50" onClick={openInsertRecord}>Inserir Registro</button>
              </div>
            </div>

            <div className="mt-2 rounded-xl border overflow-hidden">
              <div className="max-h-[50vh] overflow-auto text-sm">
                <table className="min-w-full">
                  <thead className="bg-zinc-50 sticky top-0">
                  <tr><th className="px-3 py-2 text-left w-[240px]">_id</th>
                      <th className="px-3 py-2 text-left w-[220px]">username</th>
                      <th className="px-3 py-2 text-left">props (preview)</th></tr>
                  </thead>
                  <tbody>
                  {(verifyData.users || []).map((u) => {
                    const preview = u.props && Object.keys(u.props).length
                      ? Object.entries(u.props).slice(0, 4).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" • ")
                      : "—";
                    return (
                      <tr key={u._id} className="border-t">
                        <td className="px-3 py-2 font-mono text-[12px]">{u._id}</td>
                        <td className="px-3 py-2">{u.username || "(sem username)"}</td>
                        <td className="px-3 py-2 text-zinc-600">{preview}</td>
                      </tr>
                    );
                  })}
                  {!verifyData.users?.length && (
                    <tr><td className="px-3 py-5 text-zinc-500" colSpan={3}>Nenhum usuário retornado.</td></tr>
                  )}
                  </tbody>
                </table>
              </div>
              <details className="p-3 border-t">
                <summary className="cursor-pointer text-sm">Ver JSON atual dos usuários</summary>
                <pre className="mt-2 text-xs bg-zinc-50 p-3 rounded">{JSON.stringify(verifyData.users || [], null, 2)}</pre>
              </details>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-900 text-white">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITOR JSON --- */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[60]">
          <div className="bg-white w-[min(900px,96vw)] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Editar coleção de usuários</h3>
              <button onClick={() => setEditorOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
            </div>
            <p className="text-sm text-zinc-600 mb-2">
              Edite o JSON (array). “Inserir Registro” adiciona um usuário com <code>_id</code> novo,
              <code> password: "senha123"</code> e <code>tenantId</code> do teste.
            </p>
            <textarea className="w-full h-[50vh] border rounded-xl p-3 font-mono text-sm"
                      value={editorJson} onChange={(e) => setEditorJson(e.target.value)} spellCheck={false} />
            <div className="mt-3 flex items-center justify-between">
              {editorMsg && <span className={editorMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}>{editorMsg.text}</span>}
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => setEditorOpen(false)}>Cancelar</button>
                <button className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                        disabled={editorLoading} onClick={handleSaveCollection}>
                  {editorLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* styles util */}
      <style jsx global>{`
        .input{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;width:100%}
        .input:focus{box-shadow:0 0 0 3px #e4e4e7}
        .btn{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;background:#fff}
        .btn:hover{background:#fafafa}
        .btn-primary{padding:.5rem 1rem;border-radius:.5rem;background:#09090b;color:#fff}
        .btn-primary:hover{background:#18181b}
      `}</style>
    </div>
  );
}
