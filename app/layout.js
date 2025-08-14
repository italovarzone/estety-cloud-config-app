import "./globals.css";
import Header from "./components/Header";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

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

  return (
    <html lang="pt-br">
      <body>
        {user.authed && <Header authed={user.authed} username={user.username} />}
        <main className={user.authed ? "container py-6" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
