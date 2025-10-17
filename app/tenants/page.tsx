// app/tenants/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

// pega o _id mesmo que venha como {$oid:"..."}
const oid = (x: any) => (x && typeof x === "object" && "$oid" in x ? x.$oid : x);

// helper pra exibir a URI parcialmente
function previewUri(uri?: string | null) {
  if (!uri) return "-";
  const s = String(uri);
  if (s.length <= 48) return s;
  return `${s.slice(0, 28)}…${s.slice(-16)}`;
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

type DotState = "ok" | "warn" | "err";
type DotInfo = { state: DotState; title: string };

function StatusDot({ info }: { info?: DotInfo }) {
  if (!info) {
    return <span className="inline-block align-middle spinner-xs" aria-label="Carregando status" />;
  }
  const color =
    info.state === "ok" ? "bg-emerald-500" : info.state === "warn" ? "bg-amber-500" : "bg-red-500";
  return (
    <span
      className={`inline-block align-middle w-2.5 h-2.5 rounded-full ${color}`}
      title={info.title}
      aria-label={info.title}
    />
  );
}

export default function TenantsPage() {
  // ---------- criação novo tenant (em modal) ----------
  const [createOpen, setCreateOpen] = useState(false);
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
  const [listLoading, setListLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // status por tenant
  const [statusMap, setStatusMap] = useState<Record<string, DotInfo>>({});

  // ---------- detalhes (test-db) ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [verifyData, setVerifyData] = useState<any | null>(null);
  const [currentCfgId, setCurrentCfgId] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isCreateUser, setIsCreateUser] = useState(false);

  // ---------- editar USUÁRIO ----------
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

  const [userPermOpen, setUserPermOpen] = useState(false);
  const [userPermSaving, setUserPermSaving] = useState(false);
  const [userPermMsg, setUserPermMsg] = useState<Msg>(null);
  const [availableUserDirectives, setAvailableUserDirectives] = useState<{_id:string;name:string;code:string;}[]>([]);
  const [selectedUserDirectives, setSelectedUserDirectives] = useState<string[]>([]);

  const [confirmAction, setConfirmAction] = useState(null); // "selectAll" | "removeAll" | null

  // ----- carregar lista -----
  useEffect(() => {
    load();
  }, []);
  async function load() {
    setListLoading(true);
    try {
      const res = await fetch("/api/tenants", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data) ? (data as Tenant[]) : [];
      setItems(list);
    } catch (e) {
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }

  // ----- carregar status de cada tenant (ping + users) -----
  useEffect(() => {
    if (!items.length) {
      setStatusMap({});
      return;
    }
    (async () => {
      const pairs: [string, DotInfo][] = await Promise.all(
        items.map(async (t) => {
          const id = String(oid(t._id));
          try {
            const res = await fetch(`/api/tenants/${id}/test-db?sampleUsers=1&limit=1`, {
              cache: "no-store",
            });
            const data = await res.json();
            if (res.ok && data?.ok) {
              const hasUsers = Array.isArray(data.usersSample) && data.usersSample.length > 0;
              const ping = data?.pingMs ?? data?.pingMS;
              const state: DotState = hasUsers ? "ok" : "warn";
              const title = hasUsers
                ? `OK – Banco funcionando${ping ? ` (ping ${ping}ms)` : ""}`
                : `OK – Sem usuários cadastrados${ping ? ` (ping ${ping}ms)` : ""}`;
              return [id, { state, title }] as [string, DotInfo];
            }
            const errMsg = data?.error || `Erro ${res.status}`;
            return [id, { state: "err", title: `ERRO – Banco fora do ar (${errMsg})` }];
          } catch (e: any) {
            return [id, { state: "err", title: `ERRO – Banco fora do ar (${String(e)})` }];
          }
        })
      );
      setStatusMap(Object.fromEntries(pairs));
    })();
  }, [items]);

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
        setTimeout(() => {
          setCreateOpen(false);
          setSaveMsg(null);
        }, 600);
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
      tenant: data?.tenant,
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
    if (verifyData?._raw)
      navigator.clipboard.writeText(JSON.stringify(verifyData._raw, null, 2));
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
          slug: tenantEditForm.slug, // "" => remove (server transforma em null)
          dbName: tenantEditForm.dbName,
          mongoUri: tenantEditForm.mongoUri, // "" => vira null no server
          status: tenantEditForm.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTenantEditMsg({
          type: "error",
          text: data?.message || data?.error || `Falha ao salvar (${res.status})`,
        });
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

  // ----- editar/criar USUÁRIO -----
  function openEditUser(u: any) {
    setEditMsg(null);
    setIsCreateUser(false);
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

  async function openUserPermissions(u: any) {
    // Garante que o usuário é o mesmo que está no verifyData (atualizado)
    const freshUser =
      verifyData?.users?.find((x: any) => String(x._id) === String(u._id)) || u;

    // Lê diretivas do usuário ou inicializa vazio
    const existingDirectives = Array.isArray(freshUser?.directives)
      ? freshUser.directives
      : [];

    setEditForm(freshUser);
    setSelectedUserDirectives(existingDirectives);
    setUserPermMsg(null);
    setUserPermOpen(true);

    try {
      // carrega diretivas globais
      const res = await fetch("/api/directives", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setAvailableUserDirectives(list);

      // revalida (às vezes o estado inicial é perdido quando as diretivas globais carregam)
      setSelectedUserDirectives((curr) =>
        curr.length ? curr : existingDirectives
      );
    } catch (err) {
      console.error("❌ Falha ao carregar diretivas globais:", err);
      setAvailableUserDirectives([]);
    }
  }

  async function handleSaveUserPermissions() {
  if (!currentCfgId || !editForm._id) return;
  setUserPermSaving(true);
  setUserPermMsg(null);

  try {
    const res = await fetch(
      `/api/tenants/${currentCfgId}/test-db/users/${encodeURIComponent(editForm._id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directives: selectedUserDirectives }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setUserPermMsg({ type: "error", text: data?.error || "Erro ao salvar" });
      return;
    }
    setUserPermMsg({ type: "ok", text: "Permissões do usuário atualizadas!" });

    // Atualiza na tela de detalhes
    setVerifyData((curr: any) => {
      if (!curr) return curr;
      const users = Array.isArray(curr.users) ? [...curr.users] : [];
      const idx = users.findIndex((x: any) => String(x._id) === editForm._id);
      if (idx >= 0) users[idx] = data.user;
      return { ...curr, users };
    });

    setTimeout(() => setUserPermOpen(false), 800);
  } catch (e: any) {
    setUserPermMsg({ type: "error", text: String(e) });
  } finally {
    setUserPermSaving(false);
  }
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

      setEditMsg({
        type: "ok",
        text: isCreate ? "Usuário criado com sucesso." : "Usuário atualizado com sucesso.",
      });

      setVerifyData((curr: any) => {
        if (!curr) return curr;
        const users = Array.isArray(curr.users) ? [...curr.users] : [];
        if (isCreate) {
          return { ...curr, users: [data.user] };
        } else {
          const idx = users.findIndex((x: any) => String(x._id) === editForm._id);
          if (idx >= 0) users[idx] = data.user;
          return { ...curr, users };
        }
      });

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

  const empty = useMemo(() => !listLoading && items.length === 0, [listLoading, items.length]);

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          Cadastrar Tenant
        </button>
      </div>

      {/* --- LISTA TENANTS --- */}
      <div className="overflow-x-auto border rounded-2xl bg-white min-h-[200px] relative">
        {listLoading ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-3 text-zinc-600">
              <span className="spinner" />
              <span>Carregando tenants…</span>
            </div>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left w-10"> </th>
                <th className="px-4 py-3 text-left">tenantId</th>
                <th className="px-4 py-3 text-left">name</th>
                <th className="px-4 py-3 text-left">dbName</th>
                <th className="px-4 py-3 text-left">status</th>
                <th className="px-4 py-3 text-right">ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const id = String(oid(t._id));
                const dot = statusMap[id];
                return (
                  <tr key={id} className="border-t">
                    <td className="px-4 py-3">
                      <StatusDot info={dot} />
                    </td>
                    <td className="px-4 py-3">{t.tenantId}</td>
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3">{t.dbName}</td>
                    <td className="px-4 py-3 capitalize">{t.status}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openDetails(id)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                        disabled={loadingId === id}
                      >
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
              {empty && (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={6}>
                    Sem tenants.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL CADASTRAR TENANT --- */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[60]">
          <div className="bg-white w-[min(760px,96vw)] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Cadastrar Tenant</h3>
              <button onClick={() => setCreateOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-sm mb-1">tenantId</label>
                  <input className="input w-full" value={form.tenantId} disabled />
                  <div className="text-xs text-zinc-500 mt-1">Gerado automaticamente no backend</div>
                </div>
                <div>
                  <label className="block text-sm mb-1">name *</label>
                  <input
                    className="input w-full"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">slug</label>
                  <input
                    className="input w-full"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">dbName *</label>
                  <input
                    className="input w-full"
                    value={form.dbName}
                    onChange={(e) => setForm({ ...form, dbName: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">mongoUri</label>
                  <input
                    className="input w-full"
                    value={form.mongoUri}
                    onChange={(e) => setForm({ ...form, mongoUri: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">status</label>
                  <select
                    className="input w-full"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                {saveMsg && (
                  <span
                    className={saveMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}
                  >
                    {saveMsg.text}
                  </span>
                )}
                <div className="flex gap-2">
                  <button type="button" className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => setCreateOpen(false)}>
                    Cancelar
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50" type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DETALHES --- */}
      {modalOpen && verifyData && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center z-50">
          <div className="bg-white w-[min(980px,96vw)] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Detalhes do Tenant</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => currentTenant && openEditTenant(currentTenant)}
                  className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50"
                >
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
                <button onClick={copyRawJSON} className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50">
                  Copiar JSON
                </button>
                <button onClick={() => setModalOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm rounded-xl border p-3 bg-zinc-50">
              <div>
                <div>
                  <b>Status:</b>{" "}
                  {verifyData.ok ? (
                    <span className="text-emerald-700">OK</span>
                  ) : (
                    <span className="text-red-600">Falha</span>
                  )}{" "}
                  <span className="text-zinc-600">({verifyData.status})</span>
                </div>
                <div className="mt-1">
                  <b>Tenant:</b> {verifyData.tenant?.name || "-"}{" "}
                  {verifyData.tenant?.tenantId ? (
                    <span className="text-zinc-600">
                      — {verifyData.tenant.tenantId}
                      {verifyData.tenant.slug ? ` (${verifyData.tenant.slug})` : ""}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1">
                  <b>Tenant status:</b> {verifyData.tenant?.status || "-"}
                </div>
              </div>
              <div>
                <div>
                  <b>DB:</b> {verifyData.dbName || "-"}
                </div>
                <div className="mt-1">
                  <b>URI:</b> {verifyData.uriKind || "-"}
                </div>
                <div className="mt-1">
                  <b>Ping:</b> {verifyData.pingMS ?? "-"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm rounded-xl border p-3 bg-zinc-50 mt-3">
              <div>
                <div>
                  <b>Nome:</b> {verifyData?.tenant?.name ?? currentTenant?.name ?? "-"}
                </div>
                <div className="mt-1">
                  <b>Slug:</b> {verifyData?.tenant?.slug ?? currentTenant?.slug ?? "-"}
                </div>
                <div className="mt-1">
                  <b>Status do tenant:</b> {verifyData?.tenant?.status ?? currentTenant?.status ?? "-"}
                </div>
              </div>
              <div>
                <div>
                  <b>dbName:</b> {verifyData?.tenant?.dbName ?? currentTenant?.dbName ?? "-"}
                </div>
                <div className="mt-1">
                  <b>mongoUri:</b>{" "}
                  {previewUri(verifyData?.tenant?.mongoUri ?? currentTenant?.mongoUri)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm font-medium">
                Usuários retornados ({verifyData.users?.length || 0})
              </div>
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
                      const preview =
                        u.props && Object.keys(u.props).length
                          ? Object.entries(u.props)
                              .slice(0, 4)
                              .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                              .join(" • ")
                          : "—";
                      return (
                        <tr key={String(u._id)} className="border-t">
                          <td className="px-3 py-2 font-mono text-[12px]">{String(u._id)}</td>
                          <td className="px-3 py-2">{u.username || "(sem username)"}</td>
                          <td className="px-3 py-2 text-zinc-600">{preview}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50"
                              onClick={() => openEditUser(u)}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!verifyData.users?.length && (
                      <tr>
                        <td className="px-3 py-5 text-zinc-500" colSpan={4}>
                          Nenhum usuário retornado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR/CRIAR USUÁRIO --- */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[60]">
          <div className="bg-white w-[min(720px,96vw)] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {isCreateUser ? "Adicionar usuário" : "Editar usuário"}
              </h3>
              <button
                onClick={() => {
                  setEditOpen(false);
                  setIsCreateUser(false);
                }}
                className="px-2 py-1 rounded hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">tenantId</label>
                <input
                  className="input w-full"
                  value={editForm.tenantId}
                  onChange={(e) => setEditForm({ ...editForm, tenantId: e.target.value })}
                />
                <div className="text-xs text-zinc-500 mt-1">
                  Se já existir, será substituído pelo valor acima.
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">username</label>
                <input
                  className="input w-full"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">password</label>
                <input
                  className="input w-full"
                  type="password"
                  placeholder={isCreateUser ? "" : "(deixe em branco para não alterar)"}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">city</label>
                <input
                  className="input w-full"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">pix_key</label>
                <input
                  className="input w-full"
                  value={editForm.pix_key}
                  onChange={(e) => setEditForm({ ...editForm, pix_key: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">pix_name</label>
                <input
                  className="input w-full"
                  value={editForm.pix_name}
                  onChange={(e) => setEditForm({ ...editForm, pix_name: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              {editMsg && (
                <span
                  className={editMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}
                >
                  {editMsg.text}
                </span>
              )}
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-lg border hover:bg-zinc-50"
                  onClick={() => {
                    setEditOpen(false);
                    openUserPermissions(editForm);
                  }}
                >
                  Permissões
                </button>
                <button
                  className="px-4 py-2 rounded-lg border hover:bg-zinc-50"
                  onClick={() => {
                    setEditOpen(false);
                    setIsCreateUser(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                  disabled={editLoading}
                  onClick={handleSaveUser}
                >
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
              <button onClick={() => setTenantEditOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">name *</label>
                <input
                  className="input w-full"
                  value={tenantEditForm.name}
                  onChange={(e) => setTenantEditForm({ ...tenantEditForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">slug</label>
                <input
                  className="input w-full"
                  value={tenantEditForm.slug}
                  onChange={(e) => setTenantEditForm({ ...tenantEditForm, slug: e.target.value })}
                />
                <div className="text-xs text-zinc-500 mt-1">Deixe em branco para remover.</div>
              </div>
              <div>
                <label className="block text-sm mb-1">dbName *</label>
                <input
                  className="input w-full"
                  value={tenantEditForm.dbName}
                  onChange={(e) => setTenantEditForm({ ...tenantEditForm, dbName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">mongoUri</label>
                <input
                  className="input w-full"
                  value={tenantEditForm.mongoUri}
                  onChange={(e) => setTenantEditForm({ ...tenantEditForm, mongoUri: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">status</label>
                <select
                  className="input w-full"
                  value={tenantEditForm.status}
                  onChange={(e) => setTenantEditForm({ ...tenantEditForm, status: e.target.value as any })}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              {tenantEditMsg && (
                <span
                  className={
                    tenantEditMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"
                  }
                >
                  {tenantEditMsg.text}
                </span>
              )}
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => setTenantEditOpen(false)}>
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                  disabled={tenantEditSaving}
                  onClick={handleSaveTenant}
                >
                  {tenantEditSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {userPermOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[80]">
          <div className="bg-white w-[min(600px,96vw)] rounded-2xl p-5 shadow-2xl relative">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Permissões do Usuário</h3>
              <button
                onClick={() => setUserPermOpen(false)}
                className="px-2 py-1 rounded hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            {/* Ações rápidas */}
            <div className="flex items-center justify-end gap-2 mb-3">
              <button
                onClick={() => setConfirmAction("selectAll")}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-100"
              >
                Selecionar Todos
              </button>
              <button
                onClick={() => setConfirmAction("removeAll")}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-100"
              >
                Remover Todos
              </button>
            </div>

            {/* Lista de diretivas */}
            <div className="max-h-[400px] overflow-auto border rounded-lg p-3 bg-zinc-50">
              {availableUserDirectives.map((d) => (
                <label key={d._id} className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={selectedUserDirectives.includes(d.code)}
                    onChange={(e) =>
                      setSelectedUserDirectives((curr) =>
                        e.target.checked
                          ? [...curr, d.code]
                          : curr.filter((c) => c !== d.code)
                      )
                    }
                  />
                  <span>
                    <b>{d.name}</b>{" "}
                    <span className="text-xs text-zinc-500">({d.code})</span>
                  </span>
                </label>
              ))}
              {!availableUserDirectives.length && (
                <div className="text-sm text-zinc-500">Nenhuma diretiva disponível.</div>
              )}
            </div>

            {/* Rodapé */}
            <div className="mt-4 flex items-center justify-between">
              {userPermMsg && (
                <span
                  className={
                    userPermMsg.type === "ok"
                      ? "text-emerald-700 text-sm"
                      : "text-red-600 text-sm"
                  }
                >
                  {userPermMsg.text}
                </span>
              )}
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-lg border hover:bg-zinc-50"
                  onClick={() => setUserPermOpen(false)}
                >
                  Fechar
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                  disabled={userPermSaving}
                  onClick={handleSaveUserPermissions}
                >
                  {userPermSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

            {/* 🔒 Modal de confirmação */}
            {confirmAction && (
              <div className="absolute inset-0 bg-black/40 grid place-items-center rounded-2xl z-10">
                <div className="bg-white p-5 rounded-xl shadow-xl max-w-sm w-[90%] text-center">
                  <h4 className="text-lg font-semibold mb-2">
                    Tem certeza que deseja {confirmAction === "selectAll" ? "selecionar todas" : "remover todas"} as permissões?
                  </h4>
                  <p className="text-sm text-zinc-500 mb-4">
                    Essa ação pode ser revertida antes de salvar.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="px-4 py-2 rounded-lg border hover:bg-zinc-100"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (confirmAction === "selectAll") {
                          setSelectedUserDirectives(
                            availableUserDirectives.map((d) => d.code)
                          );
                        } else if (confirmAction === "removeAll") {
                          setSelectedUserDirectives([]);
                        }
                        setConfirmAction(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-white ${
                        confirmAction === "selectAll"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            )}
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

        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{
          width:28px;height:28px;border-radius:9999px;
          border:3px solid #e5e7eb;border-top-color:#111827;animation:spin 1s linear infinite;
        }
        .spinner-xs{
          width:14px;height:14px;border-radius:9999px;
          border:2px solid #e5e7eb;border-top-color:#111827;animation:spin .8s linear infinite;
          display:inline-block;
        }
      `}</style>
    </div>
  );
}
