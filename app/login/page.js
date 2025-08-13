export default function LoginPage({ searchParams }) {
  const err = searchParams?.e;
  const presetUser = searchParams?.u || "";

  const msg =
    err === "invalid" ? "Credenciais inválidas."
    : err === "missing" ? "Usuário e senha são obrigatórios."
    : null;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f6f6" }}>
      <form action="/api/auth/login" method="post"
            style={{ background: "#fff", padding: 24, borderRadius: 12, width: 360, boxShadow: "0 6px 24px rgba(0,0,0,.08)" }}>
        <h1 style={{ margin: 0, marginBottom: 12, fontSize: 22 }}>Config Service • Login</h1>

        {msg && (
          <div role="alert" style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "#ffeae8", color: "#771d1d" }}>
            {msg}
          </div>
        )}

        <label htmlFor="username">Usuário</label>
        <input id="username" name="username" defaultValue={presetUser}
               required style={{ width: "100%", padding: 10, marginBottom: 10 }} />

        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password"
               required style={{ width: "100%", padding: 10, marginBottom: 16 }} />

        <button type="submit" style={{ width: "100%", padding: 12, border: 0, background: "#222", color: "#fff", borderRadius: 8 }}>
          Entrar
        </button>
      </form>
    </main>
  );
}
