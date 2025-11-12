// app/companies/page.tsx
"use client";
import { useEffect, useState } from "react";
import ResponsiveDialog from "../components/ResponsiveDialog";

type Tenant = { _id: string; name: string; tenantId: string };

export default function CompaniesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const [items, setItems] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tipoPessoa: "FISICA" as "FISICA" | "JURIDICA",
    name: "",
    slug: "",          // <-- novo campo
    cep: "",
    rua: "",
    titulo: "",
    bairro: "",
    cidade: "",
    uf: "",
    cnpjCpf: "",
    numeroContato: "",
    tenantRef: "",
  });

  // ------- helpers de máscara -------
  const onlyDigits = (v = "") => v.replace(/\D/g, "");
  const maskCEP = (v = "") => {
    const d = onlyDigits(v).slice(0, 8);
    return d.replace(/(\d{5})(\d{1,3})?/, (_, a, b) => (b ? `${a}-${b}` : a));
  };
  const maskCPF = (v = "") => {
    const d = onlyDigits(v).slice(0, 11);
    return d.replace(
      /(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})/,
      (_, a, b, c, d2) => {
        let out = a;
        if (b) out += "." + b;
        if (c) out += "." + c;
        if (d2) out += "-" + d2;
        return out;
      }
    );
  };
  const maskCNPJ = (v = "") => {
    const d = onlyDigits(v).slice(0, 14);
    return d.replace(
      /(\d{2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})/,
      (_, a, b, c, d2, e) => {
        let out = a;
        if (b) out += "." + b;
        if (c) out += "." + c;
        if (d2) out += "/" + d2;
        if (e) out += "-" + e;
        return out;
      }
    );
  };
  const maskPhone = (v = "") => {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length <= 10) {
      // (99) 9999-9999
      return d.replace(
        /(\d{0,2})(\d{0,4})(\d{0,4})/,
        (_, a, b, c) => {
          let out = "";
          if (a) out += `(${a}` + (a.length === 2 ? ") " : "");
          if (b) out += b + (b.length === 4 ? "-" : "");
          if (c) out += c;
          return out.trim();
        }
      );
    }
    // (99) 99999-9999
    return d.replace(
      /(\d{0,2})(\d{0,5})(\d{0,4})/,
      (_, a, b, c) => {
        let out = "";
        if (a) out += `(${a}` + (a.length === 2 ? ") " : "");
        if (b) out += b + (b.length === 5 ? "-" : "");
        if (c) out += c;
        return out.trim();
      }
    );
  };

  // ------- carregamento -------
  async function loadTenants() {
    setTenantsLoading(true);
    try {
      const res = await fetch("/api/tenants", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      setTenants(Array.isArray(data) ? data : []);
    } finally {
      setTenantsLoading(false);
    }
  }
  async function loadCompanies() {
    setListLoading(true);
    try {
      const res = await fetch("/api/companies", { cache: "no-store" });
      if (!res.ok) {
        console.error("GET /api/companies", res.status, await res.text());
        setItems([]);
        return;
      }
      const data = await res.json().catch(() => []);
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setListLoading(false);
    }
  }
  useEffect(() => {
    loadTenants();
    loadCompanies();
  }, []);

  // ------- handlers -------
  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target as { name: string; value: string };
    if (name === "cep") return setForm((f) => ({ ...f, cep: maskCEP(value) }));
    if (name === "numeroContato")
      return setForm((f) => ({ ...f, numeroContato: maskPhone(value) }));
    if (name === "cnpjCpf") {
      if (form.tipoPessoa === "FISICA")
        return setForm((f) => ({ ...f, cnpjCpf: maskCPF(value) }));
      return setForm((f) => ({ ...f, cnpjCpf: maskCNPJ(value) }));
    }
    setForm({ ...form, [name]: value });
  }

  function onTipoPessoaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tp = e.target.value as "FISICA" | "JURIDICA";
    setForm((f) => ({ ...f, tipoPessoa: tp, cnpjCpf: "" }));
  }

  async function onCepBlur() {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data && !data.erro) {
        setForm((f) => ({
          ...f,
          rua: data.logradouro || f.rua,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          uf: data.uf || f.uf,
        }));
      }
    } catch (e) {
      console.warn("ViaCEP falhou:", e);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      // reset
      setEditingId(null);
      setForm({
        tipoPessoa: "FISICA",
        name: "",
        cep: "",
        rua: "",
        titulo: "",
        bairro: "",
        cidade: "",
        uf: "",
        cnpjCpf: "",
        numeroContato: "",
        tenantRef: "",
        slug: "",          // <-- novo campo
      });
      setModalOpen(false);
      await loadCompanies();
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      tipoPessoa: "FISICA",
      name: "",
      cep: "",
      rua: "",
      titulo: "",
      bairro: "",
      cidade: "",
      uf: "",
      cnpjCpf: "",
      numeroContato: "",
      tenantRef: "",
      slug: "",          // <-- novo campo
    });
    setModalOpen(true);
  }

  function edit(c: any) {
    setEditingId(c._id);
    setForm({
      tipoPessoa: c.cnpjCpf && c.cnpjCpf.replace(/\D/g, "").length <= 11 ? "FISICA" : "JURIDICA",
      name: c.name || "",
      cep: c.cep || "",
      rua: c.rua || "",
      titulo: c.titulo || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
      uf: c.uf || "",
      cnpjCpf: c.cnpjCpf || "",
      numeroContato: c.numeroContato || "",
      tenantRef: c.tenantRef || "",
      slug: c.slug || "",   // <-- novo campo
    });
    setModalOpen(true);
  }

  async function del(id: string) {
    if (!confirm("Remover esta empresa?")) return;
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (res.ok) loadCompanies();
    else alert(await res.text());
  }

  const empty = !listLoading && items.length === 0;

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          Cadastrar Empresa
        </button>
      </div>

      {/* LISTA */}
      <div className="overflow-x-auto border rounded-2xl bg-white min-h-[200px] relative">
        {listLoading ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-3 text-zinc-600">
              <span className="spinner" />
              <span>Carregando empresas…</span>
            </div>
          </div>
        ) : (
          <table className="min-w-full text-sm table-nowrap">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left">nome</th>
                <th className="px-4 py-3 text-left">cidade/UF</th>
                <th className="px-4 py-3 text-left">cnpj/cpf</th>
                <th className="px-4 py-3 text-left">telefone</th>
                <th className="px-4 py-3 text-left">tenant</th>
                <th className="px-4 py-3 text-left">slug</th>
                <th className="px-4 py-3 text-right">ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr className="border-t" key={c._id}>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">
                    {c.cidade} / {c.uf}
                  </td>
                  <td className="px-4 py-3">{c.cnpjCpf}</td>
                  <td className="px-4 py-3">{c.numeroContato}</td>
                  <td className="px-4 py-3">
                    {c.tenantName} <span className="text-zinc-400">({c.tenantId})</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{c.slug}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50" onClick={() => edit(c)}>
                      Editar
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-lg border hover:bg-red-50 ml-2 text-red-600 border-red-200"
                      onClick={() => del(c._id)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {empty && (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={6}>
                    Sem empresas ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CADASTRAR/EDITAR EMPRESA */}
      <ResponsiveDialog
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null); }}
        title={editingId ? "Editar Empresa" : "Cadastrar Empresa"}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              className="px-4 py-2 rounded-lg border hover:bg-zinc-50"
              type="button"
              onClick={() => { setModalOpen(false); setEditingId(null); }}
            >
              Cancelar
            </button>
            <button
              form="company-form"
              className="px-4 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
              type="submit"
              disabled={saving}
            >
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar"}
            </button>
          </div>
        )}
      >
        <form id="company-form" onSubmit={save} className="grid gap-3 md:grid-cols-3">
          <input
            className="input"
            placeholder="Nome *"
            name="name"
            value={form.name}
            onChange={onChange}
            required
          />
          <input
            className="input"
            placeholder="CEP *"
            name="cep"
            value={form.cep}
            onChange={onChange}
            onBlur={onCepBlur}
            required
          />
          <select
            className="input"
            name="tenantRef"
            value={form.tenantRef}
            onChange={onChange}
            required
            disabled={tenantsLoading}
          >
            <option value="">
              {tenantsLoading ? "Carregando tenants…" : "Selecione o Tenant..."}
            </option>
            {!tenantsLoading &&
              tenants.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} — {t.tenantId}
                </option>
              ))}
          </select>

          <input
            className="input"
            placeholder="Rua *"
            name="rua"
            value={form.rua}
            onChange={onChange}
            required
          />
          <input
            className="input"
            placeholder="Título (opcional)"
            name="titulo"
            value={form.titulo}
            onChange={onChange}
          />
          <input
            className="input"
            placeholder="Bairro *"
            name="bairro"
            value={form.bairro}
            onChange={onChange}
            required
          />
          <input
            className="input"
            placeholder="Cidade *"
            name="cidade"
            value={form.cidade}
            onChange={onChange}
            required
          />
          <input
            className="input"
            placeholder="UF *"
            name="uf"
            value={form.uf}
            onChange={onChange}
            required
          />

          {/* Tipo de pessoa + doc com máscara dinâmica */}
          <select className="input" value={form.tipoPessoa} onChange={onTipoPessoaChange}>
            <option value="FISICA">Pessoa Física</option>
            <option value="JURIDICA">Pessoa Jurídica</option>
          </select>
          <input
            className="input"
            placeholder={form.tipoPessoa === "FISICA" ? "CPF *" : "CNPJ *"}
            name="cnpjCpf"
            value={form.cnpjCpf}
            onChange={onChange}
            required
          />

          {/* Telefone/Celular */}
          <input
            className="input"
            placeholder="Telefone/Celular *"
            name="numeroContato"
            value={form.numeroContato}
            onChange={onChange}
            required
          />

          <input
            className="input"
            placeholder="Slug"
            name="slug"
            value={form.slug}
            onChange={onChange}
            required
          />
        </form>
      </ResponsiveDialog>

      {/* util styles */}
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
      `}</style>
    </div>
  );
}
