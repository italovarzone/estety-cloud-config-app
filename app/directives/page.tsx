"use client";
import { useEffect, useState } from "react";

type Directive = {
  _id: string;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
};

type Msg = { type: "ok" | "error"; text: string } | null;

export default function DirectivesPage() {
  const [list, setList] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/directives", { cache: "no-store" });
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!form.name || !form.code) {
      setMsg({ type: "error", text: "Preencha nome e código." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/directives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const txt = await res.text();
        setMsg({ type: "error", text: txt || `Erro (${res.status})` });
        return;
      }
      setMsg({ type: "ok", text: "Diretiva criada com sucesso!" });
      setForm({ name: "", code: "", description: "" });
      await load();
      setTimeout(() => {
        setModalOpen(false);
        setMsg(null);
      }, 700);
    } catch (e: any) {
      setMsg({ type: "error", text: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir esta diretiva?")) return;
    await fetch(`/api/directives/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Diretivas</h1>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          Cadastrar Diretiva
        </button>
      </div>

      <div className="overflow-x-auto border rounded-2xl bg-white min-h-[200px] relative">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-3 text-zinc-600">
              <span className="spinner" />
              <span>Carregando diretivas…</span>
            </div>
          </div>
        ) : (
          <table className="min-w-full text-sm table-wrap">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d._id} className="border-t">
                  <td className="px-4 py-3">{d.name}</td>
                  <td className="px-4 py-3 font-mono">{d.code}</td>
                  <td className="px-4 py-3 text-zinc-600">{d.description || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(d._id)}
                      className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={4}>
                    Nenhuma diretiva cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CADASTRO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[60]">
          <div className="bg-white w-[min(720px,96vw)] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Cadastrar Diretiva</h3>
              <button onClick={() => setModalOpen(false)} className="px-2 py-1 rounded hover:bg-zinc-100">✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Nome *</label>
                  <input
                    className="input w-full"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Código *</label>
                  <input
                    className="input w-full font-mono"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm mb-1">Descrição</label>
                <textarea
                  className="input w-full"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                {msg && (
                  <span
                    className={msg.type === "ok" ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}
                  >
                    {msg.text}
                  </span>
                )}
                <div className="flex gap-2">
                  <button type="button" className="px-4 py-2 rounded-lg border hover:bg-zinc-50" onClick={() => setModalOpen(false)}>
                    Cancelar
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;width:100%}
        .input:focus{box-shadow:0 0 0 3px #e4e4e7}
        .btn{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;background:#fff}
        .btn:hover{background:#fafafa}
        .btn-primary{padding:.5rem 1rem;border-radius:.5rem;background:#09090b;color:#fff}
        .btn-primary:hover{background:#18181b}
        .spinner{width:28px;height:28px;border-radius:9999px;border:3px solid #e5e7eb;border-top-color:#111827;animation:spin 1s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
