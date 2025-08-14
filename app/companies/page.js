"use client";
import { useEffect, useState } from "react";

export default function CompaniesPage() {
  const [tenants, setTenants] = useState([]);
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // novo: tipo de pessoa controla a máscara do documento
  const [form, setForm] = useState({
    tipoPessoa: "FISICA", // FISICA | JURIDICA
    name:"", cep:"", rua:"", titulo:"", bairro:"", cidade:"", uf:"",
    cnpjCpf:"", numeroContato:"", tenantRef:""
  });

  // ------- helpers de máscara -------
  const onlyDigits = (v="") => v.replace(/\D/g, "");
  const maskCEP = (v="") => {
    const d = onlyDigits(v).slice(0,8);
    return d.replace(/(\d{5})(\d{1,3})?/, (_,a,b)=> b? `${a}-${b}` : a);
  };
  const maskCPF = (v="") => {
    const d = onlyDigits(v).slice(0,11);
    return d.replace(/(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})/, (_,a,b,c,d2)=>{
      let out=a; if(b) out+=`.`+b; if(c) out+=`.`+c; if(d2) out+=`-${d2}`; return out;
    });
  };
  const maskCNPJ = (v="") => {
    const d = onlyDigits(v).slice(0,14);
    return d.replace(/(\d{2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})/, (_,a,b,c,d2,e)=>{
      let out=a; if(b) out+=`.`+b; if(c) out+=`.`+c; if(d2) out+=`/${d2}`; if(e) out+=`-${e}`; return out;
    });
  };
  const maskPhone = (v="") => {
    const d = onlyDigits(v).slice(0,11);
    if (d.length <= 10) {
      // (99) 9999-9999
      return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_,a,b,c)=>{
        let out=""; if(a) out+=`(${a}`+(a.length===2?") ":""); if(b) out+=b+(b.length===4?"-":""); if(c) out+=c; return out.trim();
      });
    }
    // (99) 99999-9999
    return d.replace(/(\d{0,2})(\d{0,5})(\d{0,4})/, (_,a,b,c)=>{
      let out=""; if(a) out+=`(${a}`+(a.length===2?") ":""); if(b) out+=b+(b.length===5?"-":""); if(c) out+=c; return out.trim();
    });
  };

  // ------- carregamento -------
  async function loadTenants() {
    const res = await fetch("/api/tenants", { cache: "no-store" });
    const data = await res.json().catch(()=>[]);
    setTenants(Array.isArray(data) ? data : []);
  }
  async function loadCompanies() {
    const res = await fetch("/api/companies", { cache: "no-store" });
    if (!res.ok) { console.error("GET /api/companies", res.status, await res.text()); setItems([]); return; }
    const data = await res.json().catch(()=>[]);
    setItems(Array.isArray(data) ? data : []);
  }
  useEffect(() => { loadTenants(); loadCompanies(); }, []);

  // ------- handlers -------
  function onChange(e) {
    const { name, value } = e.target;
    if (name === "cep") return setForm(f => ({ ...f, cep: maskCEP(value) }));
    if (name === "numeroContato") return setForm(f => ({ ...f, numeroContato: maskPhone(value) }));
    if (name === "cnpjCpf") {
      if (form.tipoPessoa === "FISICA") return setForm(f => ({ ...f, cnpjCpf: maskCPF(value) }));
      return setForm(f => ({ ...f, cnpjCpf: maskCNPJ(value) }));
    }
    setForm({ ...form, [name]: value });
  }

  function onTipoPessoaChange(e) {
    const tp = e.target.value;
    // limpa o doc ao trocar o tipo
    setForm(f => ({ ...f, tipoPessoa: tp, cnpjCpf: "" }));
  }

  async function onCepBlur() {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data && !data.erro) {
        setForm(f => ({
          ...f,
          rua: data.logradouro || f.rua,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          uf: data.uf || f.uf
        }));
      }
    } catch (e) {
      console.warn("ViaCEP falhou:", e);
    }
  }

  async function save(e) {
    e.preventDefault();
    const payload = { ...form };
    const method = editingId ? "PATCH" : "POST";
    const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setEditingId(null);
      setForm({
        tipoPessoa: "FISICA",
        name:"", cep:"", rua:"", titulo:"", bairro:"", cidade:"", uf:"",
        cnpjCpf:"", numeroContato:"", tenantRef:""
      });
      await loadCompanies();
    } else {
      alert(await res.text());
    }
  }

  function edit(c) {
    setEditingId(c._id);
    setForm({
      tipoPessoa: (c.cnpjCpf && c.cnpjCpf.length <= 14) ? "FISICA" : "JURIDICA",
      name: c.name||"", cep: c.cep||"", rua:c.rua||"", titulo:c.titulo||"",
      bairro:c.bairro||"", cidade:c.cidade||"", uf:c.uf||"",
      cnpjCpf:c.cnpjCpf||"", numeroContato:c.numeroContato||"",
      tenantRef:c.tenantRef || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(id) {
    if (!confirm("Remover esta empresa?")) return;
    const res = await fetch(`/api/companies/${id}`, { method:"DELETE" });
    if (res.ok) loadCompanies();
    else alert(await res.text());
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Empresas</h1>

      <section className="card">
        <h3 className="text-lg font-semibold mb-3">{editingId ? "Editar Empresa" : "Nova Empresa"}</h3>
        <form onSubmit={save} className="grid gap-3 md:grid-cols-3">
          <input className="input" placeholder="Nome *" name="name" value={form.name} onChange={onChange} required />
          <input className="input" placeholder="CEP *" name="cep" value={form.cep} onChange={onChange} onBlur={onCepBlur} required />
          <select className="input" name="tenantRef" value={form.tenantRef} onChange={onChange} required>
            <option value="">Selecione o Tenant...</option>
            {tenants.map(t => <option key={t._id} value={t._id}>{t.name} — {t.tenantId}</option>)}
          </select>

          <input className="input" placeholder="Rua *" name="rua" value={form.rua} onChange={onChange} required />
          <input className="input" placeholder="Título (opcional)" name="titulo" value={form.titulo} onChange={onChange} />
          <input className="input" placeholder="Bairro *" name="bairro" value={form.bairro} onChange={onChange} required />
          <input className="input" placeholder="Cidade *" name="cidade" value={form.cidade} onChange={onChange} required />
          <input className="input" placeholder="UF *" name="uf" value={form.uf} onChange={onChange} required />

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

          <div className="col-span-full flex gap-2">
            <button className="btn btn-primary" type="submit">{editingId ? "Salvar alterações" : "Salvar"}</button>
            {editingId && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    tipoPessoa: "FISICA",
                    name:"", cep:"", rua:"", titulo:"", bairro:"", cidade:"", uf:"",
                    cnpjCpf:"", numeroContato:"", tenantRef:""
                  });
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h3 className="text-lg font-semibold mb-3">Lista</h3>
        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr className="tr">
                <th className="th">nome</th>
                <th className="th">cidade/UF</th>
                <th className="th">cnpj/cpf</th>
                <th className="th">telefone</th>
                <th className="th">tenant</th>
                <th className="th">ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr className="tr" key={c._id}>
                  <td className="td">{c.name}</td>
                  <td className="td">{c.cidade} / {c.uf}</td>
                  <td className="td">{c.cnpjCpf}</td>
                  <td className="td">{c.numeroContato}</td>
                  <td className="td">{c.tenantName} <span className="text-zinc-400">({c.tenantId})</span></td>
                  <td className="td">
                    <div className="flex gap-2">
                      <button className="btn" onClick={()=>edit(c)}>Editar</button>
                      <button className="btn btn-danger" onClick={()=>del(c._id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td className="td" colSpan={6}>Sem empresas ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
