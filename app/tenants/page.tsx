"use client";
import { useEffect, useState } from "react";

// pega o _id mesmo que venha como {$oid:"..."}
const oid = (x: any) => (x && typeof x === "object" && "$oid" in x ? x.$oid : x);

export default function TenantsPage() {
  // form (mantive o tenantId desabilitado, pois no backend ele é gerado)
  const [form, setForm] = useState({
    tenantId: "",
    name: "",
    slug: "",
    dbName: "",
    mongoUri: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<null | { type: "ok" | "error"; text: string }>(null);

  // lista tenants
  const [items, setItems] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // modal detalhes (antes era “verificação”)
  const [modalOpen, setModalOpen] = useState(false);
  const [verifyData, setVerifyData] = useState<any | null>(null);
  const [currentCfgId, setCurrentCfgId] = useState<string | null>(null);

  // modal editar usuário
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<null | { type: "ok" | "error"; text: string }>(null);
  const [editForm, setEditForm] = useState<{
    _id: string;
    username: string;
    password: string;
    city: string;
    pix_key: string;
    pix_name: string;
    tenantId: string;
  }>({
    _id: "",
    username: "",
    password: "",
    city: "",
    pix_key: "",
    pix_name: "",
    tenantId: "",
  });

  useEffect(() => { load(); }, []);
  async function load() {
    const res = await fetch("/api/tenants", { cache: "no-store" });
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    if (!form.name || !form.dbName) {
      setSaveMsg({ type: "error", text: "Preencha name e dbName." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
        setForm({ tenantId: "", name: "", slug: "", dbName: "", mongoUri: "", status: "active" });
        await load();
      }
    } catch (err: any) {
      setSaveMsg({ type: "error", text: String(err) });
    } finally {
      setSaving(false);
    }
  }

  // ----- DETALHES (usa GET /test-db) -----
  function normalizeVerifyResponse(status: number, data: any) {
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

  async function openDetails(idRaw: any) {
    const id = oid(idRaw); // _id do doc do tenant na base de configuração
    setLoadingId(id);
    setVerifyData(null);
    setCurrentCfgId(id);
    try {
      const res = await fetch(`/api/tenants/${id}/test-db?sampleUsers=1&limit=50`, { cache: "no-store" });
      const raw = await res.json();
      const norm = normalizeVerifyResponse(res.status, raw);
      setVerifyData(norm);
      setModalOpen(true);
    } catch (e: any) {
      setVerifyData({ ok: false, status: "ERR", _raw: { error: String(e) }, users: [] });
      setModalOpen(true);
    } finally {
      setLoadingId(null);
    }
  }

  function copyRawJSON() {
    if (verifyData?._raw) navigator.clipboard.writeText(JSON.stringify(verifyData._raw, null, 2));
  }

  // ----- EDITAR USUÁRIO -----
  function openEditUser(u: any) {
    setEditMsg(null);
    setEditForm({
      _id: String(u._id),
      username: u.username || "",
      password: "", // não exibimos senha atual; usuário define nova se quiser
      city: u?.props?.city || "",
      pix_key: u?.props?.pix_key || "",
      pix_name: u?.props?.pix_name || "",
      tenantId: u?.tenantId || (verifyData?.tenant?.tenantId || ""),
    });
    setEditOpen(true);
  }

  async function handleSaveUser() {
    if (!currentCfgId) return;
    setEditLoading(true);
    setEditMsg(null);
    try {
      const res = await fetch(`/api/tenants/${currentCfgId}/test-db/users/${encodeURIComponent(editForm._id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // sempre sobrescrevemos tenantId com o que vier do form:
          tenantId: editForm.tenantId || null,
          username: editForm.username || null,
          // senha só envia se usuário preencheu algo:
          ...(editForm.password ? { password: editForm.password } : {}),
          city: editForm.city || null,
          pix_key: editForm.pix_key || null,
          pix_name: editForm.pix_name || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setEditMsg({ type: "error", text: data?.error || `Falha ao salvar (${res.status})` });
      } else {
        setEditMsg({ type: "ok", text: "Usuário atualizado com sucesso." });
        // atualiza na lista da modal:
        if (verifyData?.users?.length) {
          setVerifyData((curr: any) => {
            if (!curr) return curr;
            const nextUsers = [...(curr.users || [])];
            const idx = nextUsers.findIndex((x: any) => String(x._id) === editForm._id);
            if (idx >= 0) nextUsers[idx] = data.user; // sanitizado (sem password)
            return { ...curr, users: nextUsers };
          });
        }
        // fecha modal depois de um pequeno delay visual
        setTimeout(() => setEditOpen(false), 700);
      }
    } catch (e: any) {
      setEditMsg({ type: "error", text: String(e) });
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>

      {/* --- NOVO TENANT --- */}
      <form onSubmit={handleCreate} className="rounded-2xl border p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Novo Tenant</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">tenantId</label>
            <input className="input w-full" value={form.tenantId} disabled />
            <div className="text-xs text-zinc-500 mt-1">Gerado automaticamente no backend</div>
          </div>
          <div>
            <label className="block text-sm mb-1">name *</label>
            <input className="input w-full" value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm mb-1">slug</label>
            <input className="input w-full" value={form.slug}
                   onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">dbName *</label>
            <input className="input w-full" value={form.dbName}
                   onChange={(e) => setForm({ ...form, dbName: e.target.value })} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">mongoUri</label>
            <input className="input w-full" value={form.mongoUri}
                   onChange={(e) => setForm({ ...form, mongoUri: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">status</label>
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
                  <button onClick={() => openDetails(id)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                          disabled={loadingId === id}>
                    {loadingId === id ? "Abrindo..." : "Detalhes"}
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

      {/* --- MODAL DETALHES --- */}
      {modalOpen && verifyData && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center z-50">
          <div className="bg-white w-[min(980px,96vw)] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Detalhes do Tenant</h2>
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
            </div>

            <div className="mt-2 rounded-xl border overflow-hidden">
              <div className="max-h-[55vh] overflow-auto text-sm">
                <table className="min-w-full">
                  <thead className="bg-zinc-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-[240px]">_id</th>
                    <th className="px-3 py-2 text-left w-[200px]">username</th>
                    <th className="px-3 py-2 text-left">props (preview)</th>
                    <th className="px-3 py-2 text-right w-[120px]">ações</th>
                  </tr>
                  </thead>
                  <tbody>
                  {(verifyData.users || []).map((u: any) => {
                    const preview = u.props && Object.keys(u.props).length
                      ? Object.entries(u.props).slice(0, 4).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" • ")
                      : "—";
                    return (
                      <tr key={String(u._id)} className="border-t">
                        <td className="px-3 py-2 font-mono text-[12px]">{String(u._id)}</td>
                        <td className="px-3 py-2">{u.username || "(sem username)"}</td>
                        <td className="px-3 py-2 text-zinc-600">{preview}</td>
                        <td className="px-3 py-2 text-right">
                          <button className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50"
                                  onClick={() => openEditUser(u)}>Editar</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!verifyData.users?.length && (
                    <tr><td className="px-3 py-5 text-zinc-500" colSpan={4}>Nenhum usuário retornado.</td></tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-900 text-white">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR USUÁRIO --- */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[60]">
          <div className="bg-white w-[min(720px,96vw)] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Editar usuário</h3>
              <button onClick={() => setEditOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">tenantId</label>
                <input className="input w-full" value={editForm.tenantId}
                       onChange={(e) => setEditForm({ ...editForm, tenantId: e.target.value })} />
                <div className="text-xs text-zinc-500 mt-1">Se já existir, será substituído pelo valor acima.</div>
              </div>
              <div>
                <label className="block text-sm mb-1">username</label>
                <input className="input w-full" value={editForm.username}
                       onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1">password</label>
                <input className="input w-full" type="password" placeholder="(deixe em branco para não alterar)"
                       value={editForm.password}
                       onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1">city</label>
                <input className="input w-full" value={editForm.city}
                       onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1">pix_key</label>
                <input className="input w-full" value={editForm.pix_key}
                       onChange={(e) => setEditForm({ ...editForm, pix_key: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1">pix_name</label>
                <input className="input w-full" value={editForm.pix_name}
                       onChange={(e) => setEditForm({ ...editForm, pix_name: e.target.value })} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              {editMsg && <span className={editMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}>{editMsg.text}</span>}
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => setEditOpen(false)}>Cancelar</button>
                <button className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                        disabled={editLoading} onClick={handleSaveUser}>
                  {editLoading ? "Salvando..." : "Salvar"}
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
