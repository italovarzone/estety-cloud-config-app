"use client";
import { headers } from "next/headers";
import { useEffect, useState, useMemo } from "react";

type Msg = { type: "ok" | "error"; text: string } | null;

type Tenant = { _id: string; tenantId: string; name: string };
type Directive = { _id: string; name: string; code: string };

type User = {
  _id?: string;
  userId?: string;
  email: string;
  password?: string;
  tenantIds: string[];
  directives: string[];
  type: 0 | 1;
};

export default function UsersEstetyCloudPage() {
  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<User>({ email: "", password: "", tenantIds: [], directives: [], type: 0 });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<Msg>(null);
  const [msg, setMsg] = useState<Msg>(null);

  // Tenants e diretivas
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [userPermOpen, setUserPermOpen] = useState(false);
  const [availableUserDirectives, setAvailableUserDirectives] = useState<Directive[]>([]);
  const [selectedUserDirectives, setSelectedUserDirectives] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<"selectAll" | "removeAll" | null>(null);

  useEffect(() => { load(); loadTenants(); }, []);
  async function load() {
    setLoading(true);
    try {
        const res = await fetch("/api/users-estetycloud", {
        cache: "no-store",
        headers: { "x-config-api-key": "super-secreto" },
        });
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch { setList([]); } finally { setLoading(false); }
  }
  async function loadTenants() {
    try {
      const res = await fetch("/api/tenants", { cache: "no-store" });
      const data = await res.json();
      setTenants(Array.isArray(data) ? data.map((t) => ({ _id: String(t._id.$oid || t._id), tenantId: t.tenantId, name: t.name })) : []);
    } catch (e) {
      console.error("Falha ao carregar tenants:", e);
      setTenants([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    if (!form.email || (!form._id && !form.password)) {
      setSaveMsg({ type: "error", text: "Preencha e-mail e senha." });
      return;
    }
    setSaving(true);
    try {
      const method = form._id ? "PATCH" : "POST";
      const url = form._id ? `/api/users-estetycloud/${form._id}` : "/api/users-estetycloud";
      const body: any = {
        email: form.email,
        password: form.password || undefined,
        tenantIds: form.tenantIds,
        directives: selectedUserDirectives,
        type: form.type,
      };
      // 🔹 Campos PIX opcionais
      if ((form as any).pix_key !== undefined) body.pix_key = (form as any).pix_key;
      if ((form as any).pix_name !== undefined) body.pix_name = (form as any).pix_name;
      if ((form as any).city !== undefined) body.city = (form as any).city;
      const res = await fetch(url, { method, headers: { "content-type": "application/json", "x-config-api-key": "super-secreto" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || `Erro ${res.status}`);
      setSaveMsg({ type: "ok", text: form._id ? "Usuário atualizado!" : "Usuário criado!" });
      await load();
      setTimeout(() => {
        setCreateOpen(false);
        setEditOpen(false);
        setSaveMsg(null);
      }, 600);
    } catch (e: any) {
      setSaveMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setForm({ email: "", password: "", tenantIds: [], directives: [], type: 0 });
    setSelectedUserDirectives([]);
    setCreateOpen(true);
  }
  function openEdit(u: User) {
    setForm({ ...u, password: "" });
    setSelectedUserDirectives(u.directives || []);
    setEditOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este usuário permanentemente?")) return;
    try {
      const res = await fetch(`/api/users-estetycloud/${id}`, { method: "DELETE", headers: { "x-config-api-key": "super-secreto" } });
      if (!res.ok) throw new Error("Falha ao excluir");
      await load();
      setMsg({ type: "ok", text: "Usuário excluído com sucesso." });
    } catch (e: any) {
      setMsg({ type: "error", text: String(e.message || e) });
    }
  }

  const empty = useMemo(() => !loading && list.length === 0, [loading, list.length]);

  // ---------- Modal de Diretivas ----------
  async function openUserPermissions() {
    setUserPermOpen(true);
    try {
      const res = await fetch("/api/directives", { cache: "no-store" });
      const data = await res.json();
      setAvailableUserDirectives(Array.isArray(data) ? data : []);
    } catch {
      setAvailableUserDirectives([]);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários Estety Cloud</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          Cadastrar Usuário
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg ${msg.type === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          {msg.text}
        </div>
      )}

      {/* --- LISTA --- */}
      <div className="overflow-x-auto border rounded-2xl bg-white min-h-[200px] relative">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center"><div className="flex items-center gap-3 text-zinc-600"><span className="spinner" /><span>Carregando…</span></div></div>
        ) : (
          <table className="min-w-full text-sm table-wrap">
            <thead className="bg-zinc-50">
              <tr><th className="px-4 py-3 text-left">E-mail</th><th className="px-4 py-3 text-left">Tenants</th><th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-left">Diretivas</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.tenantIds.join(", ") || "—"}</td>
                  <td className="px-4 py-3">{u.type === 1 ? "Admin" : "Operador"}</td>
                  <td className="px-4 py-3 text-zinc-500">{u.directives?.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(u)} className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50">Editar</button>
                    <button onClick={() => handleDelete(u._id!)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 ml-2">Excluir</button>
                  </td>
                </tr>
              ))}
              {empty && (
                <tr><td colSpan={5} className="px-4 py-6 text-zinc-500 text-center">Nenhum usuário cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL CADASTRO/EDIÇÃO --- */}
      {(createOpen || editOpen) && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[60]">
          <div className="bg-white w-[min(720px,96vw)] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{editOpen ? "Editar Usuário" : "Cadastrar Usuário"}</h3>
              <button onClick={() => { setCreateOpen(false); setEditOpen(false); }} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-sm mb-1">E-mail *</label>
                  <input className="input w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" required />
                </div>
                <div><label className="block text-sm mb-1">Senha {editOpen && "(deixe em branco para não alterar)"}</label>
                  <input className="input w-full" type="password" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editOpen} />
                </div>
              </div>

              {/* Multi-Select Tenants */}
              <div>
                <label className="block text-sm mb-1">Tenants vinculados</label>
                <select multiple className="input w-full h-32" onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setForm({ ...form, tenantIds: values });
                }} value={form.tenantIds}>
                  {tenants.map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>{t.name} ({t.tenantId})</option>
                  ))}
                </select>
                {form.tenantIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.tenantIds.map((tid) => {
                      const tn = tenants.find((t) => t.tenantId === tid);
                      return (
                        <span key={tid} className="flex items-center gap-1 bg-zinc-100 border px-2 py-1 rounded-lg text-sm">
                          {tn?.name || tid}
                          <button onClick={() => setForm({ ...form, tenantIds: form.tenantIds.filter((x) => x !== tid) })} type="button" className="text-zinc-500 hover:text-red-600">✕</button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Tipo</label>
                  <select className="input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: Number(e.target.value) as 0 | 1 })}>
                    <option value={0}>Operador</option>
                    <option value={1}>Admin</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={openUserPermissions} className="w-full px-4 py-2 rounded-lg border hover:bg-zinc-50">
                    Gerenciar Diretivas
                  </button>
                </div>
              </div>

              {/* Campos PIX */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">PIX Key</label>
                  <input className="input w-full" value={(form as any).pix_key || ""} onChange={(e) => setForm({ ...(form as any), pix_key: e.target.value } as any)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">PIX Name</label>
                  <input className="input w-full" value={(form as any).pix_name || ""} onChange={(e) => setForm({ ...(form as any), pix_name: e.target.value } as any)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Cidade</label>
                  <input className="input w-full" value={(form as any).city || ""} onChange={(e) => setForm({ ...(form as any), city: e.target.value } as any)} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                {saveMsg && (
                  <span className={saveMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}>
                    {saveMsg.text}
                  </span>
                )}
                <div className="flex gap-2">
                  <button type="button" className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => { setCreateOpen(false); setEditOpen(false); }}>
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DIRETIVAS --- */}
      {userPermOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[80]">
          <div className="bg-white w-[min(600px,96vw)] rounded-2xl p-5 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Permissões do Usuário</h3>
              <button onClick={() => setUserPermOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
            </div>

            <div className="flex items-center justify-end gap-2 mb-3">
              <button onClick={() => setConfirmAction("selectAll")} className="text-sm px-3 py-1.5 rounded-lg border hover:bg-zinc-100">Selecionar Todos</button>
              <button onClick={() => setConfirmAction("removeAll")} className="text-sm px-3 py-1.5 rounded-lg border hover:bg-zinc-100">Remover Todos</button>
            </div>

            <div className="max-h-[400px] overflow-auto border rounded-lg p-3 bg-zinc-50">
              {availableUserDirectives.map((d) => (
                <label key={d._id} className="flex items-center gap-2 mb-1">
                  <input type="checkbox" checked={selectedUserDirectives.includes(d.code)} onChange={(e) => {
                    setSelectedUserDirectives((curr) =>
                      e.target.checked ? [...curr, d.code] : curr.filter((c) => c !== d.code)
                    );
                  }} />
                  <span><b>{d.name}</b> <span className="text-xs text-zinc-500">({d.code})</span></span>
                </label>
              ))}
              {!availableUserDirectives.length && (
                <div className="text-sm text-zinc-500">Nenhuma diretiva disponível.</div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div />
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => setUserPermOpen(false)}>Fechar</button>
                <button className="px-4 py-2 rounded-lg bg-zinc-900 text-white" onClick={() => setUserPermOpen(false)}>Salvar</button>
              </div>
            </div>

            {confirmAction && (
              <div className="absolute inset-0 bg-black/40 grid place-items-center rounded-2xl z-10">
                <div className="bg-white p-5 rounded-xl shadow-xl max-w-sm w-[90%] text-center">
                  <h4 className="text-lg font-semibold mb-2">
                    Tem certeza que deseja {confirmAction === "selectAll" ? "selecionar todas" : "remover todas"}?
                  </h4>
                  <div className="flex justify-center gap-3 mt-4">
                    <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-lg border hover:bg-zinc-100">Cancelar</button>
                    <button onClick={() => {
                      if (confirmAction === "selectAll") {
                        setSelectedUserDirectives(availableUserDirectives.map((d) => d.code));
                      } else {
                        setSelectedUserDirectives([]);
                      }
                      setConfirmAction(null);
                    }} className={`px-4 py-2 rounded-lg text-white ${confirmAction === "selectAll" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .input{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;width:100%}
        .btn{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;background:#fff}
        .btn:hover{background:#fafafa}
        .btn-primary{padding:.5rem 1rem;border-radius:.5rem;background:#09090b;color:#fff}
        .btn-primary:hover{background:#18181b}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:28px;height:28px;border-radius:9999px;border:3px solid #e5e7eb;border-top-color:#111827;animation:spin 1s linear infinite}
      `}</style>
    </div>
  );
}
