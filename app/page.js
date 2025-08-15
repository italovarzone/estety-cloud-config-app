// app/page.js
export const runtime = "nodejs"; // evita cair no edge runtime

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";

export default async function Page() {
  const token = cookies().get("config_token")?.value;

  // sem token -> login
  if (!token) redirect("/login");

  try {
    const key = new TextEncoder().encode(process.env.CONFIG_JWT_SECRET || "change-me");
    await jwtVerify(token, key);
    // token ok -> tenants
    redirect("/tenants");
  } catch {
    // token inválido/expirado -> login
    redirect("/login");
  }
}
