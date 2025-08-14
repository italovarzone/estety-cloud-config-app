import Imagem from "../components/Imagem";

export default function LoginPage({ searchParams }) {
  const err = searchParams?.e;
  const presetUser = searchParams?.u || "";
  const msg =
    err === "invalid"
      ? "Credenciais inválidas."
      : err === "missing"
      ? "Usuário e senha são obrigatórios."
      : null;

  return (
    <div className="min-h-screen grid place-items-center">
      <form action="/api/auth/login" method="post" className="card w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-3">
          {/* ícone de configuração grande */}
          <Imagem className="h-14 w-auto" src="/engrenagem.png" alt="Engrenagem" />
        </div>

        <h2 className="text-2xl font-semibold text-center">EC Configurações</h2>

        {msg && (
          <div role="alert" className="rounded-xl bg-red-50 text-red-700 px-3 py-2">
            {msg}
          </div>
        )}

        <div className="space-y-1">
          <label className="label" htmlFor="username">Usuário</label>
          <input className="input" id="username" name="username" defaultValue={presetUser} autoFocus required />
        </div>

        <div className="space-y-1">
          <label className="label" htmlFor="password">Senha</label>
          <input className="input" id="password" type="password" name="password" required />
        </div>

        <button className="btn btn-primary w-full mt-2" type="submit">Entrar</button>
      </form>
    </div>
  );
}
