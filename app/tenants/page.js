"use client";
import { useEffect, useState } from "react";

export default function TenantsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    tenantId: "",
    name: "",
    slug: "",
    dbName: "",
    mongoUri: "",
    status: "active",
  });
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const res = await fetch("/api/tenants", { cache: "no-store" });
    const data = await res.json();
    setItems(data);
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const method = editingId ? "PATCH" : "POST";
    const url = editingId ? `/api/tenants/${editingId}` : "/api/tenants";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ tenantId: "", name: "", slug: "", dbName: "", mongoUri: "", status: "active" });
      setEditingId(null);
      await load();
    } else {
      alert(await res.text());
    }
  }

  function edit(t) {
    setEditingId(t._id);
    setForm({
      tenantId: t.tenantId || "",
      name: t.name || "",
      slug: t.slug || "",
      dbName: t.dbName || "",
      mongoUri: t.mongoUri || "",
      status: t.status || "active",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(id) {
    if (!confirm("Remover este tenant?")) return;
    const res = await fetch(`/api/tenants/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else alert(await res.text());
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ tenantId: "", name: "", slug: "", dbName: "", mongoUri: "", status: "active" });
  }

  return (
    <main style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Tenants</h1>
        <a href="/api/auth/logout">Sair</a>
      </header>

      <section style={{ background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,.05)" }}>
        <h3>{editingId ? "Editar Tenant" : "Novo Tenant"}</h3>
        <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <input placeholder="tenantId *" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} required />
          <input placeholder="name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="slug (opcional)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input placeholder="dbName *" value={form.dbName} onChange={(e) => setForm({ ...form, dbName: e.target.value })} required />
          <input placeholder="mongoUri (opcional)" value={form.mongoUri} onChange={(e) => setForm({ ...form, mongoUri: e.target.value })} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" style={{ padding: 10, background: "#222", color: "#fff", border: 0, borderRadius: 8 }}>
              {editingId ? "Salvar alterações" : "Salvar"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} style={{ padding: 10, background: "#ddd", border: 0, borderRadius: 8 }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Lista</h3>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>tenantId</th>
                <th style={{ textAlign: "left", padding: 8 }}>name</th>
                <th style={{ textAlign: "left", padding: 8 }}>slug</th>
                <th style={{ textAlign: "left", padding: 8 }}>dbName</th>
                <th style={{ textAlign: "left", padding: 8 }}>mongoUri</th>
                <th style={{ textAlign: "left", padding: 8 }}>status</th>
                <th style={{ textAlign: "left", padding: 8 }}>ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{t.tenantId}</td>
                  <td style={{ padding: 8 }}>{t.name}</td>
                  <td style={{ padding: 8 }}>{t.slug || "-"}</td>
                  <td style={{ padding: 8 }}>{t.dbName}</td>
                  <td style={{ padding: 8, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.mongoUri || "-"}</td>
                  <td style={{ padding: 8 }}>{t.status}</td>
                  <td style={{ padding: 8, display: "flex", gap: 8 }}>
                    <button onClick={() => edit(t)} style={{ padding: "6px 10px" }}>Editar</button>
                    <button onClick={() => del(t._id)} style={{ padding: "6px 10px", background: "crimson", color: "#fff", border: 0, borderRadius: 6 }}>Excluir</button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={7} style={{ padding: 16, textAlign: "center", color: "#888" }}>Sem tenants ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
