import { NextResponse } from "next/server";
import { SignJWT } from "jose";

const SECRET = process.env.CONFIG_JWT_SECRET;
const key = new TextEncoder().encode(SECRET);

export async function POST(req) {
  let username, password;
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const b = await req.json(); username = b.username; password = b.password;
  } else {
    const fd = await req.formData(); username = fd.get("username"); password = fd.get("password");
  }

  // erro → volta para /login com mensagem
  if (!username || !password) {
    const url = new URL("/login", req.url);
    url.searchParams.set("e", "missing");
    return NextResponse.redirect(url, { status: 303 });
  }
  if (username !== process.env.APP_LOGIN || password !== process.env.APP_SENHA) {
    const url = new URL("/login", req.url);
    url.searchParams.set("e", "invalid");
    // opcional: manter o usuário digitado
    url.searchParams.set("u", username);
    return NextResponse.redirect(url, { status: 303 });
  }

  // sucesso → seta cookie e vai para /tenants
  const token = await new SignJWT({ role: "admin", sub: "config-admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);

  const res = NextResponse.redirect(new URL("/tenants", req.url), { status: 303 });
  res.cookies.set("config_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
