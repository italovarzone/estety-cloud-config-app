"use client";
import { useEffect, useMemo, useState } from "react";

// util: pega o _id mesmo que venha como {$oid: "..."}
const oid = (x) => (x && typeof x === "object" && "$oid" in x ? x.$oid : x);

export default function TenantsPage() {
  // ---- FORM DE CADASTRO ----
  const [form, setForm] = useState({
    tenantId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "",
    name: "",
    slug: "",
    dbName: "",
    mongoUri: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // ---- LISTA + VERIFICAÇÃO ----
  const [items, setItems] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [verifyData, setVerifyData] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const res = await fetch("/api/tenants", { cache: "no-store" });
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  }

  function resetForm() {
    setForm({
      tenantId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "",
      name: "",
      slug: "",
      dbName: "",
      mongoUri: "",
      status: "active",
    });
    setSaveMsg(null);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaveMsg(null);

    // validação mínima
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
          slug: form.slug ? String(form.slug).trim() : null,
          dbName: String(form.dbName).trim(),
          mongoUri: form.mongoUri ? String(form.mongoUri).trim() : null,
          status: form.status,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        setSaveMsg({ type: "error", text: txt || `Falha ao salvar (${res.status})` });
      } else {
        setSaveMsg({ type: "ok", text: "Tenant criado com sucesso." });
        resetForm();
        await load();
      }
    } catch (err) {
      setSaveMsg({ type: "error", text: String(err) });
    } finally {
      setSaving(false);
    }
  }

  function genGuid() {
    try {
      const id = crypto.randomUUID();
      setForm((f) => ({ ...f, tenantId: id }));
    } catch {
      // fallback simples
      const id = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
      setForm((f) => ({ ...f, tenantId: id }));
    }
  }

  async function handleVerify(idRaw) {
    const id = oid(idRaw);
    setLoadingId(id);
    setVerifyData(null);
    try {
      const res = await fetch(`/api/tenants/${id}/test-db?sampleUsers=1&limit=20`, { cache: "no-store" });
      const data = await res.json();
      setVerifyData(data);
      setModalOpen(true);
    } catch (e) {
      setVerifyData({ ok: false, error: String(e) });
      setModalOpen(true);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>

      {/* ---------- CARD: NOVO TENANT ---------- */}
      <form onSubmit={handleCreate} className="rounded-2xl border p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Novo Tenant</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">tenantId *</label>
            <div className="flex gap-2">
              <input
                className="input w-full"
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                placeholder="GUID"
                required
              />
              <button type="button" onClick={genGuid} className="btn">
                Novo ID
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">name *</label>
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome do tenant"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">slug (opcional)</label>
            <input
              className="input w-full"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="ex.: minha-clinica"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">dbName *</label>
            <input
              className="input w-full"
              value={form.dbName}
              onChange={(e) => setForm({ ...form, dbName: e.target.value })}
              placeholder="ex.: lashdbdev"
              required
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-sm mb-1">mongoUri (opcional)</label>
            <input
              className="input w-full"
              value={form.mongoUri}
              onChange={(e) => setForm({ ...form, mongoUri: e.target.value })}
              placeholder="mongodb+srv://user:pass@cluster/..."
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

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {saveMsg && (
            <span
              className={
                saveMsg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"
              }
            >
              {saveMsg.text}
            </span>
          )}
        </div>
      </form>

      {/* ---------- TABELA ---------- */}
      <div className="overflow-x-auto border rounded-2xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left">tenantId</th>
              <th className="px-4 py-3 text-left">name</th>
              <th className="px-4 py-3 text-left">dbName</th>
              <th className="px-4 py-3 text-left">status</th>
              <th className="px-4 py-3 text-right">ações</th>
            </tr>
          </thead>
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
                    <button
                      onClick={() => handleVerify(id)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                      disabled={loadingId === id}
                    >
                      {loadingId === id ? "Verificando..." : "Verificar conexão"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={5}>
                  Sem tenants.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- MODAL DE RESULTADO ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center z-50">
          <div className="bg-white w-[min(700px,92vw)] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Resultado da verificação</h2>
              <button onClick={() => setModalOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
            </div>

            {!verifyData && <p className="text-sm text-zinc-600">Carregando...</p>}

            {verifyData && (
              <div className="space-y-3">
                <div className="text-sm">
                  <div><b>Status:</b> {verifyData.ok ? "OK" : "Falha"} ({verifyData.status})</div>
                  <div>
                    <b>Tenant:</b> {verifyData.tenantId}{" "}
                    {verifyData.slug ? `(${verifyData.slug})` : ""}
                  </div>
                  <div><b>DB:</b> {verifyData.dbName}</div>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 px-3 py-2 text-sm">Usuários retornados</div>
                  <div className="max-h-80 overflow-auto text-sm">
                    <pre className="p-3">{JSON.stringify(verifyData.result, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 text-right">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-900 text-white">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Tailwind helpers (opcional, mas deixa o visual consistente)
   Coloque no globals.css se preferir como @apply:
   .input { @apply px-3 py-2 rounded-lg border w-full focus:outline-none focus:ring-2 focus:ring-zinc-200; }
   .btn { @apply px-3 py-2 rounded-lg border bg-white hover:bg-zinc-50; }
   .btn-primary { @apply px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800; }
*/
