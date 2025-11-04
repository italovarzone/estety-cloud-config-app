import "./globals.css";
import Header from "./components/Header";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { initHealthCron } from "../lib/healthCron";

export const metadata = { title: "Config Service — Estety Cloud" };

async function getUser() {
  const cookieStore = cookies();
  const token = cookieStore.get("config_token")?.value;
  if (!token) return { authed: false };

  try {
    const key = new TextEncoder().encode(process.env.CONFIG_JWT_SECRET);
    const { payload } = await jwtVerify(token, key);
    return { authed: true, username: payload.username || "admin" };
  } catch {
    return { authed: false };
  }
}

export default async function RootLayout({ children }) {
  const user = await getUser();
  // inicia cron no primeiro acesso ao servidor (evita múltiplas execuções via guard interno)
  initHealthCron();

  return (
    <html lang="pt-br">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#c0c0c0ff" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/logo_pwd.png" />
      </head>
      <body>
        {user.authed && <Header authed={user.authed} username={user.username} />}
        {/* Evita container duplo: cada página já aplica sua própria .container */}
        <main className={user.authed ? "py-6" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
