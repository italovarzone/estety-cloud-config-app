"use client";
import { useEffect, useState } from "react";

export default function TenantsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    tenantId: "", name: "", slug: "", dbName: "", mongoUri: "", status: "active",
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/tenants", { cache: "no-store" });
    if (!res.ok) {
      console.error("GET /api/tenants", res.status, await res.text());
      setItems([]); setLoading(false); return;
    }
    const data = await res.json().catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const method = editingId ? "PATCH" : "POST";
    const url = editingId ? `/api/tenants/${editingId}` : "/api/tenants";
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setForm({ tenantId: "", name: "", slug: "", dbName: "", mongoUri: "", status: "active" });
      setEditingId(null);
      await load();
    } else {
      alert(await res.text());
    }
  }

  async function del(id) {
    if (!confirm("Remover este tenant?")) return;
    const res = await fetch(`/api/tenants/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert(await res.text());
  }

  function edit(t) {
    setEditingId(t._id);
    setForm({
      tenantId: t.tenantId || "", name: t.name || "", slug: t.slug || "",
      dbName: t.dbName || "", mongoUri: t.mongoUri || "", status: t.status || "active",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tenants</h1>

      <section className="card">
        <h3 className="text-lg font-semibold mb-3">{editingId ? "Editar Tenant" : "Novo Tenant"}</h3>
        <form onSubmit={save} className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="tenantId *" value={form.tenantId} onChange={e=>setForm({...form, tenantId:e.target.value})} required />
          <input className="input" placeholder="name *" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
          <input className="input" placeholder="slug (opcional)" value={form.slug} onChange={e=>setForm({...form, slug:e.target.value})} />
          <input className="input" placeholder="dbName *" value={form.dbName} onChange={e=>setForm({...form, dbName:e.target.value})} required />
          <input className="input" placeholder="mongoUri (opcional)" value={form.mongoUri} onChange={e=>setForm({...form, mongoUri:e.target.value})} />
          <select className="input" value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <div className="col-span-full flex gap-2">
            <button className="btn btn-primary" type="submit">{editingId ? "Salvar alterações" : "Salvar"}</button>
            {editingId && <button className="btn" type="button" onClick={()=>{setEditingId(null);setForm({tenantId:"",name:"",slug:"",dbName:"",mongoUri:"",status:"active"});}}>Cancelar</button>}
          </div>
        </form>
      </section>

      <section className="card">
        <h3 className="text-lg font-semibold mb-3">Lista</h3>
        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr className="tr">
                <th className="th">tenantId</th>
                <th className="th">name</th>
                <th className="th">slug</th>
                <th className="th">dbName</th>
                <th className="th">mongoUri</th>
                <th className="th">status</th>
                <th className="th">ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr className="tr" key={t._id}>
                  <td className="td">{t.tenantId}</td>
                  <td className="td">{t.name}</td>
                  <td className="td">{t.slug || "-"}</td>
                  <td className="td">{t.dbName}</td>
                  <td className="td max-w-[240px] truncate">{t.mongoUri || "-"}</td>
                  <td className="td">{t.status === "active" ? <span className="badge badge-green">active</span> : <span className="badge badge-gray">inactive</span>}</td>
                  <td className="td">
                    <div className="flex gap-2">
                      <button className="btn" onClick={()=>edit(t)}>Editar</button>
                      <button className="btn btn-danger" onClick={()=>del(t._id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && !loading && <tr><td className="td" colSpan={7}>Sem tenants ainda.</td></tr>}
              {loading && <tr><td className="td" colSpan={7}>Carregando...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
