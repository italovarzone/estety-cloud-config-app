"use client";
import { useEffect, useState } from "react";

// pega o _id mesmo que venha como {$oid:"..."}
const oid = (x: any) => (x && typeof x === "object" && "$oid" in x ? x.$oid : x);

// helper pra exibir a URI parcialmente
function previewUri(uri?: string | null) {
  if (!uri) return "-";
  const s = String(uri);
  if (s.length <= 36) return s;
  return s;
}

type Tenant = {
  _id: string | { $oid: string };
  tenantId: string;
  name: string;
  slug?: string | null;
  dbName: string;
  mongoUri?: string | null;
  status: "active" | "inactive";
};

type Msg = { type: "ok" | "error"; text: string } | null;

export default function TenantsPage() {
  // ---------- criação novo tenant ----------
  const [form, setForm] = useState({
    tenantId: "",
    name: "",
    slug: "",
    dbName: "",
    mongoUri: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<Msg>(null);

  // ---------- listagem ----------
  const [items, setItems] = useState<Tenant[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // ---------- detalhes (test-db) ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [verifyData, setVerifyData] = useState<any | null>(null);
  const [currentCfgId, setCurrentCfgId] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isCreateUser, setIsCreateUser] = useState(false);

  // ---------- editar USUÁRIO (em test-db) ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<Msg>(null);
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

  // ---------- editar TENANT ----------
  type TenantEditForm = {
    _id: string;
    name: string;
    slug: string;
    dbName: string;
    mongoUri: string;
    status: "active" | "inactive";
  };
  const [tenantEditOpen, setTenantEditOpen] = useState(false);
  const [tenantEditSaving, setTenantEditSaving] = useState(false);
  const [tenantEditMsg, setTenantEditMsg] = useState<Msg>(null);
  const [tenantEditForm, setTenantEditForm] = useState<TenantEditForm>({
    _id: "",
    name: "",
    slug: "",
    dbName: "",
    mongoUri: "",
    status: "active",
  });

  // ----- carregar -----
  useEffect(() => { load(); }, []);
  async function load() {
    const res = await fetch("/api/tenants", { cache: "no-store" });
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  }

  // ----- criar -----
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

  // ----- normalizar resposta do test-db -----
  function normalizeVerifyResponse(status: number, data: any) {
    const users = Array.isArray(data?.usersSample) ? data.usersSample : [];
    return {
      ok: !!data?.ok || (status >= 200 && status < 300),
      status,
      tenant: data?.tenant, // se o endpoint já devolver o tenant completo
      dbName: data?.dbName,
      uriKind: data?.uriKind,
      pingMS: data?.pingMs ?? data?.pingMS ?? "-",
      users,
      _raw: data,
    };
  }

  // ----- abrir detalhes -----
  async function openDetails(idRaw: any) {
    const id = oid(idRaw);
    setLoadingId(id);
    setVerifyData(null);
    setCurrentCfgId(id);

    // guarda o tenant da lista pra usar como fallback
    const tenantFromList = items.find((x) => oid(x._id) === id) || null;
    setCurrentTenant(tenantFromList as any);

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

  // ----- abrir modal de edição do tenant -----
  function openEditTenant(t: Tenant) {
    const id = String(oid(t._id));
    setTenantEditMsg(null);
    setTenantEditForm({
      _id: id,
      name: t.name || "",
      slug: t.slug || "",
      dbName: t.dbName || "",
      mongoUri: t.mongoUri || "",
      status: (t.status as "active" | "inactive") || "active",
    });
    setTenantEditOpen(true);
  }

  // ----- salvar tenant -----
  async function handleSaveTenant() {
    setTenantEditMsg(null);
    if (!tenantEditForm._id || !tenantEditForm.name || !tenantEditForm.dbName) {
      setTenantEditMsg({ type: "error", text: "Preencha name e dbName." });
      return;
    }
    setTenantEditSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantEditForm._id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: tenantEditForm.name,
          slug: tenantEditForm.slug,         // "" => remove (server transforma em null)
          dbName: tenantEditForm.dbName,
          mongoUri: tenantEditForm.mongoUri, // "" => vira null no server
          status: tenantEditForm.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTenantEditMsg({ type: "error", text: data?.message || data?.error || `Falha ao salvar (${res.status})` });
        return;
      }

      // atualiza a tabela
      setItems((curr) => curr.map((x) => (String(oid(x._id)) === tenantEditForm._id ? (data as Tenant) : x)));

      // mantém modal de detalhes consistente
      setCurrentTenant(data);

      setTenantEditMsg({ type: "ok", text: "Tenant atualizado com sucesso." });
      setTimeout(() => setTenantEditOpen(false), 700);
    } catch (e: any) {
      setTenantEditMsg({ type: "error", text: String(e) });
    } finally {
      setTenantEditSaving(false);
    }
  }

  // ----- editar USUÁRIO (test-db) -----
  function openEditUser(u: any) {
    setEditMsg(null);
    setEditForm({
      _id: String(u._id),
      username: u.username || "",
      password: "",
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
    const isCreate = isCreateUser === true;
    const url = isCreate
      ? `/api/tenants/${currentCfgId}/test-db/users`
      : `/api/tenants/${currentCfgId}/test-db/users/${encodeURIComponent(editForm._id)}`;

    const method = isCreate ? "POST" : "PATCH";

    const body: any = {
      tenantId: editForm.tenantId || null,
      username: editForm.username || null,
      city: editForm.city || null,
      pix_key: editForm.pix_key || null,
      pix_name: editForm.pix_name || null,
    };

    // criar => exige username+password; editar => só manda password se mudou
    if (isCreate) {
      if (!editForm.username || !editForm.password) {
        setEditMsg({ type: "error", text: "Preencha username e password." });
        setEditLoading(false);
        return;
      }
      body.password = editForm.password;
    } else if (editForm.password) {
      body.password = editForm.password;
    }

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    // parse seguro: se vier HTML/404 não quebra com Unexpected token '<'
    let data: any = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      const txt = await res.text();
      throw new Error(txt.slice(0, 300));
    }

    if (!res.ok || data?.ok === false) {
      setEditMsg({ type: "error", text: data?.error || `Falha ao salvar (${res.status})` });
      return;
    }

    setEditMsg({ type: "ok", text: isCreate ? "Usuário criado com sucesso." : "Usuário atualizado com sucesso." });

    // atualiza lista na modal
    setVerifyData((curr: any) => {
      if (!curr) return curr;
      const users = Array.isArray(curr.users) ? [...curr.users] : [];
      if (isCreate) {
        // regra: apenas 1 usuário por tenant — substitui lista inteira
        return { ...curr, users: [data.user] };
      } else {
        const idx = users.findIndex((x: any) => String(x._id) === editForm._id);
        if (idx >= 0) users[idx] = data.user;
        return { ...curr, users };
      }
    });

    // fecha modal
    setTimeout(() => {
      setEditOpen(false);
      setIsCreateUser(false);
    }, 700);
  } catch (e: any) {
    setEditMsg({ type: "error", text: String(e.message || e) });
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
            const id = String(oid(t._id));
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
                  <button
                    onClick={() => openEditTenant(t)}
                    className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50 ml-2"
                  >
                    Editar
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
                <button onClick={() => currentTenant && openEditTenant(currentTenant)} className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50">
                  Editar
                </button>
                {(verifyData?.users?.length ?? 0) === 0 && (
                <button
                  onClick={() => {
                    setIsCreateUser(true);
                    setEditMsg(null);
                    setEditForm({
                      _id: "",
                      username: "",
                      password: "",
                      city: "",
                      pix_key: "",
                      pix_name: "",
                      tenantId: verifyData?.tenant?.tenantId || currentTenant?.tenantId || "",
                    });
                    setEditOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50"
                >
                  Adicionar usuário
                </button>
              )}
                <button onClick={() => setModalOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
              </div>
            </div>

            {/* Bloco do status do teste */}
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

            {/* Bloco com as infos de conexão do tenant (name, slug, dbName, mongoUri, status) */}
            <div className="grid grid-cols-1 gap-2 text-sm rounded-xl border p-3 bg-zinc-50 mt-3">
              <div>
                <div><b>Nome:</b> {verifyData?.tenant?.name ?? currentTenant?.name ?? "-"}</div>
                <div className="mt-1"><b>Slug:</b> {verifyData?.tenant?.slug ?? currentTenant?.slug ?? "-"}</div>
                <div className="mt-1"><b>Status do tenant:</b> {verifyData?.tenant?.status ?? currentTenant?.status ?? "-"}</div>
              </div>
              <div>
                <div><b>dbName:</b> {verifyData?.tenant?.dbName ?? currentTenant?.dbName ?? "-"}</div>
                <div className="mt-1"><b>mongoUri:</b> {previewUri(verifyData?.tenant?.mongoUri ?? currentTenant?.mongoUri)}</div>
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
                <button className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => { setEditOpen(false); setIsCreateUser(false); }}>Cancelar</button>
                <button className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                        disabled={editLoading} onClick={handleSaveUser}>
                  {editLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR TENANT --- */}
      {tenantEditOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[60]">
          <div className="bg-white w-[min(720px,96vw)] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Editar tenant</h3>
              <button onClick={() => { setEditOpen(false); setIsCreateUser(false); }} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">name *</label>
                <input className="input w-full" value={tenantEditForm.name}
                       onChange={(e) => setTenantEditForm({ ...tenantEditForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1">slug</label>
                <input className="input w-full" value={tenantEditForm.slug}
                       onChange={(e) => setTenantEditForm({ ...tenantEditForm, slug: e.target.value })} />
                <div className="text-xs text-zinc-500 mt-1">Deixe em branco para remover.</div>
              </div>
              <div>
                <label className="block text-sm mb-1">dbName *</label>
                <input className="input w-full" value={tenantEditForm.dbName}
                       onChange={(e) => setTenantEditForm({ ...tenantEditForm, dbName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1">mongoUri</label>
                <input className="input w-full" value={tenantEditForm.mongoUri}
                       onChange={(e) => setTenantEditForm({ ...tenantEditForm, mongoUri: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1">status</label>
                <select className="input w-full" value={tenantEditForm.status}
                        onChange={(e) => setTenantEditForm({ ...tenantEditForm, status: e.target.value as any })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              {tenantEditMsg && <span className={tenantEditMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}>{tenantEditMsg.text}</span>}
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => setTenantEditOpen(false)}>Cancelar</button>
                <button className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                        disabled={tenantEditSaving}
                        onClick={handleSaveTenant}>
                  {tenantEditSaving ? "Salvando..." : "Salvar"}
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
