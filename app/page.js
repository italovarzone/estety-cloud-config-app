import Link from "next/link";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,.08)" }}>
        <h1 style={{ marginTop: 0 }}>Config Service</h1>
        <p>Painel para gerenciar tenants/empresas.</p>
        <p><Link href="/login">Ir para Login</Link></p>
      </div>
    </main>
  );
}
