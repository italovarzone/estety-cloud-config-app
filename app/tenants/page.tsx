// app/tenants/page.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

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

type DotState = "ok" | "err";
type DotInfo = { state: DotState; title: string };

function StatusDot({ info }: { info?: DotInfo }) {
  if (!info) {
    return <span className="inline-block align-middle spinner-xs" aria-label="Carregando status" />;
  }
  const color = info.state === "ok" ? "bg-emerald-500" : "bg-red-500";
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
  // criação de usuário pelo tenant removida (fluxo agora via users_estetycloud)

  // ---------- logs de notificações ----------
  type LogEntry = {
    _id?: any;
    tenantId?: string;
    channel?: "webpush" | "email" | string;
    job?: string;
    recipient?: string | string[] | null;
    content?: any;
    success?: boolean;
    error?: any;
    createdAt?: string | Date;
  };
  const [logsLoading, setLogsLoading] = useState(false);
  const logsReqSeq = useRef(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(5);
  const [logFilterJob, setLogFilterJob] = useState("");
  const [logFilterChannel, setLogFilterChannel] = useState("");
  const [logFilterSuccess, setLogFilterSuccess] = useState(""); // "", "true", "false"
  const [logFilterFrom, setLogFilterFrom] = useState(""); // yyyy-mm-dd
  const [logFilterTo, setLogFilterTo] = useState("");   // yyyy-mm-dd

  function dateToRangeStart(d: string) {
    // d: yyyy-mm-dd
    if (!d) return "";
    return new Date(`${d}T00:00:00.000Z`).toISOString();
  }
  function dateToRangeEnd(d: string) {
    if (!d) return "";
    return new Date(`${d}T23:59:59.999Z`).toISOString();
  }

  async function loadLogs(page = 1, cfgIdOverride?: string | null, pageSizeOverride?: number) {
    const cfgId = cfgIdOverride ?? currentCfgId;
    if (!cfgId) return;
    setLogsLoading(true);
    const seq = ++logsReqSeq.current;
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      const limit = pageSizeOverride ?? logsPageSize ?? 5;
      qs.set("limit", String(limit));
      if (logFilterJob.trim()) qs.set("job", logFilterJob.trim());
      if (logFilterChannel) qs.set("channel", logFilterChannel);
      if (logFilterSuccess) qs.set("success", logFilterSuccess);
      if (logFilterFrom) qs.set("from", dateToRangeStart(logFilterFrom));
      if (logFilterTo) qs.set("to", dateToRangeEnd(logFilterTo));
      const res = await fetch(`/api/tenants/${cfgId}/logs?` + qs.toString(), { cache: "no-store" });
      const data = await res.json();
      // Prevent race: ignore if a newer request has started
      if (seq !== logsReqSeq.current) return;
      if (res.ok && data?.ok) {
        setLogs(data.items || []);
        setLogsTotal(data.total || 0);
        setLogsPage(data.page || page);
        setLogsPageSize(data.pageSize || limit || 5);
      } else {
        setLogs([]);
        setLogsTotal(0);
      }
    } catch (e) {
      setLogs([]);
      setLogsTotal(0);
    } finally {
      setLogsLoading(false);
    }
  }

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
              const ping = data?.pingMs ?? data?.pingMS;
              const title = `OK – Banco funcionando${ping ? ` (ping ${ping}ms)` : ""}`;
              return [id, { state: "ok", title }] as [string, DotInfo];
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
      // carrega logs (primeira página)
      setLogs([]);
      setLogsTotal(0);
      setLogsPage(1);
      setLogsPageSize(5);
      setLogFilterJob("");
      setLogFilterChannel("");
      setLogFilterSuccess("");
      setLogFilterFrom("");
      setLogFilterTo("");
      await loadLogs(1, id, 5);
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
    if (!currentCfgId || !editForm._id) return;

    setEditLoading(true);
    setEditMsg(null);

    try {
      const url = `/api/tenants/${currentCfgId}/test-db/users/${encodeURIComponent(editForm._id)}`;

      const body: any = {
        tenantId: editForm.tenantId || null,
        username: editForm.username || null,
        city: editForm.city || null,
        pix_key: editForm.pix_key || null,
        pix_name: editForm.pix_name || null,
      };

      if (editForm.password) {
        body.password = editForm.password;
      }

      const res = await fetch(url, {
        method: "PATCH",
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

      setEditMsg({ type: "ok", text: "Usuário atualizado com sucesso." });

      setVerifyData((curr: any) => {
        if (!curr) return curr;
        const users = Array.isArray(curr.users) ? [...curr.users] : [];
        const idx = users.findIndex((x: any) => String(x._id) === editForm._id);
        if (idx >= 0) users[idx] = data.user;
        return { ...curr, users };
      });

      setTimeout(() => {
        setEditOpen(false);
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
          <table className="min-w-full text-sm table-nowrap">
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
                {/* Fluxo de criação de usuário removido deste contexto */}
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

            {/* Logs de notificações */}
            <div className="mt-3 border rounded-xl p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Logs de notificações</h3>
                <span className="text-xs text-zinc-500">{logsTotal} registros</span>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <div>
                  <label className="block text-xs mb-1">Job</label>
                  <input className="input w-full" placeholder="ex: appointments:create" value={logFilterJob} onChange={(e)=>setLogFilterJob(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Canal</label>
                  <select className="input w-full" value={logFilterChannel} onChange={(e)=>setLogFilterChannel(e.target.value)}>
                    <option value="">(todos)</option>
                    <option value="webpush">webpush</option>
                    <option value="email">email</option>
                    <option value="crud">crud</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Sucesso</label>
                  <select className="input w-full" value={logFilterSuccess} onChange={(e)=>setLogFilterSuccess(e.target.value)}>
                    <option value="">(todos)</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1">De (data)</label>
                    <input type="date" className="input w-full" value={logFilterFrom} onChange={(e)=>setLogFilterFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Até (data)</label>
                    <input type="date" className="input w-full" value={logFilterTo} onChange={(e)=>setLogFilterTo(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <button className="btn" onClick={()=>{ setLogsPage(1); loadLogs(1, currentCfgId); }} disabled={logsLoading}>
                  {logsLoading ? "Filtrando…" : "Aplicar filtros"}
                </button>
                <div className="text-xs text-zinc-500">Página {logsPage} / {Math.max(1, Math.ceil((logsTotal||0)/(logsPageSize||10)))}</div>
              </div>

              {/* Desktop/tablet table */}
              <div className="overflow-x-auto border rounded-lg hidden md:block">
                <table className="min-w-full text-sm table-nowrap">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">Canal</th>
                      <th className="px-3 py-2 text-left">Job</th>
                      <th className="px-3 py-2 text-left">Sucesso</th>
                      <th className="px-3 py-2 text-left">Destinatário</th>
                      <th className="px-3 py-2 text-left">Conteúdo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, idx) => {
                      const dt = l.createdAt ? new Date(l.createdAt) : null;
                      const when = dt ? dt.toLocaleString('pt-BR') : '-';
                      const recip = Array.isArray(l.recipient) ? l.recipient.join(', ') : (l.recipient || '-');
                      let contentPreview = '-';
                      if (l.channel === 'webpush') {
                        const title = (l as any)?.content?.title || '';
                        const body = (l as any)?.content?.body || '';
                        contentPreview = title || body ? `${title}${title && body ? ' — ' : ''}${body}` : '-';
                      } else if (l.channel === 'email') {
                        const subj = (l as any)?.content?.subject || '';
                        contentPreview = subj || '-';
                      } else {
                        // generic/crud: compact preview from content
                        try {
                          const raw = (l as any)?.content;
                          if (raw && typeof raw === 'object') {
                            const keys = Object.keys(raw);
                            const kv = keys.slice(0, 4).map(k => `${k}: ${String((raw as any)[k]).slice(0, 40)}`);
                            contentPreview = kv.length ? kv.join(', ') : '-';
                          } else if (raw != null) {
                            contentPreview = String(raw).slice(0, 80);
                          }
                        } catch {}
                      }
                      return (
                        <tr key={String((l as any)._id?._id || (l as any)._id || idx)} className="border-t">
                          <td className="px-3 py-2 align-top whitespace-nowrap">{when}</td>
                          <td className="px-3 py-2 align-top">{l.channel || '-'}</td>
                          <td className="px-3 py-2 align-top">{l.job || '-'}</td>
                          <td className="px-3 py-2 align-top">
                            {l.success === true ? (
                              <span className="inline-block px-2 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200">true</span>
                            ) : l.success === false ? (
                              <span className="inline-block px-2 py-0.5 rounded text-red-700 bg-red-50 border border-red-200">false</span>
                            ) : (
                              <span className="text-zinc-500">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top" title={String(recip)}>{String(recip)}</td>
                          <td className="px-3 py-2 align-top" title={contentPreview}>{contentPreview}</td>
                        </tr>
                      );
                    })}
                    {!logs.length && (
                      <tr>
                        <td className="px-3 py-6 text-zinc-500" colSpan={6}>{logsLoading ? 'Carregando…' : 'Sem registros para os filtros informados.'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="md:hidden grid gap-2">
                {logs.length ? (
                  logs.map((l, idx) => {
                    const dt = l.createdAt ? new Date(l.createdAt) : null;
                    const when = dt ? dt.toLocaleString('pt-BR') : '-';
                    const recip = Array.isArray(l.recipient) ? l.recipient.join(', ') : (l.recipient || '-');
                    let contentPreview = '-';
                    if (l.channel === 'webpush') {
                      const title = (l as any)?.content?.title || '';
                      const body = (l as any)?.content?.body || '';
                      contentPreview = title || body ? `${title}${title && body ? ' — ' : ''}${body}` : '-';
                    } else if (l.channel === 'email') {
                      const subj = (l as any)?.content?.subject || '';
                      contentPreview = subj || '-';
                    } else {
                      try {
                        const raw = (l as any)?.content;
                        if (raw && typeof raw === 'object') {
                          const keys = Object.keys(raw);
                          const kv = keys.slice(0, 4).map(k => `${k}: ${String((raw as any)[k]).slice(0, 40)}`);
                          contentPreview = kv.length ? kv.join(', ') : '-';
                        } else if (raw != null) {
                          contentPreview = String(raw).slice(0, 80);
                        }
                      } catch {}
                    }
                    return (
                      <div key={String((l as any)._id?._id || (l as any)._id || idx)} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-zinc-500">{when}</div>
                          <div className="text-xs px-2 py-0.5 rounded border bg-zinc-50">{l.channel || '-'}</div>
                        </div>
                        <div className="mt-1 font-medium">{l.job || '-'}</div>
                        <div className="mt-1 text-xs">
                          <span className="text-zinc-500 mr-1">Sucesso:</span>
                          {l.success === true ? (
                            <span className="inline-block px-2 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200">true</span>
                          ) : l.success === false ? (
                            <span className="inline-block px-2 py-0.5 rounded text-red-700 bg-red-50 border border-red-200">false</span>
                          ) : (
                            <span className="text-zinc-500">-</span>
                          )}
                        </div>
                        {recip && recip !== '-' && (
                          <div className="mt-1 text-xs"><span className="text-zinc-500">Destinatário:</span> {recip}</div>
                        )}
                        <div className="mt-2 text-sm">
                          <span className="text-zinc-500">Conteúdo:</span> <span title={contentPreview}>{contentPreview}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-zinc-500 border rounded-lg p-4">{logsLoading ? 'Carregando…' : 'Sem registros para os filtros informados.'}</div>
                )}
              </div>

              {/* paginação */}
              {(() => {
                const pages = Math.max(1, Math.ceil((logsTotal || 0) / (logsPageSize || 5)));
                const canPrev = logsPage > 1 && !logsLoading;
                const canNext = logsPage < pages && !logsLoading;
                return (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-zinc-500">Mostrando {logs.length} de {logsTotal}</div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50 disabled:opacity-50" disabled={!canPrev} onClick={()=>{ const p = Math.max(1, logsPage-1); setLogsPage(p); loadLogs(p, currentCfgId); }}>Anterior</button>
                      <div className="text-xs text-zinc-600">{logsPage} / {pages}</div>
                      <button className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50 disabled:opacity-50" disabled={!canNext} onClick={()=>{ const p = logsPage+1; setLogsPage(p); loadLogs(p, currentCfgId); }}>Próxima</button>
                    </div>
                  </div>
                );
              })()}
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
              <h3 className="text-lg font-semibold">Editar usuário</h3>
              <button
                onClick={() => {
                  setEditOpen(false);
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
                  placeholder="(deixe em branco para não alterar)"
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
