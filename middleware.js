import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const key = new TextEncoder().encode(process.env.CONFIG_JWT_SECRET);

// Rotas que exigem token
const PROTECTED = ["/tenants", "/companies", "/api/tenants", "/api/companies"];
// Rotas que NÃO devem exigir token
const EXCEPTIONS = [
  "/api/tenants/resolve",
  "/api/tenants/public",   // ✅ liberar esta
  "/api/auth/login",
  "/api/auth/logout",
  "/login",
];


export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("config_token")?.value;

  // 1) HOME: decide destino antes de qualquer render
  if (pathname === "/") {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    try {
      await jwtVerify(token, key);
      return NextResponse.redirect(new URL("/tenants", req.url));
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 2) LOGIN: se já estiver logado, manda para tenants
  if (pathname === "/login" && token) {
    try {
      await jwtVerify(token, key);
      return NextResponse.redirect(new URL("/tenants", req.url));
    } catch {
      // token inválido → deixa ir pro login
    }
  }

  // 3) Proteção das rotas privadas
  const isProtected =
    PROTECTED.some((p) => pathname.startsWith(p)) &&
    !EXCEPTIONS.some((e) => pathname.startsWith(e));

  if (!isProtected) return NextResponse.next();

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, key);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

// ⚠️ Inclui a raiz "/" no matcher para já redirecionar antes de render
export const config = {
  matcher: [
    "/",
    "/login",
    "/tenants/:path*",
    "/companies/:path*",
    "/api/tenants/:path*",
    "/api/companies/:path*",
  ],
};
