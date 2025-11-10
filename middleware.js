import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const key = new TextEncoder().encode(process.env.CONFIG_JWT_SECRET);

const PROTECTED = ["/tenants", "/api/tenants"];
const EXCEPTIONS = [
  "/api/tenants/resolve",
  "/api/tenants/public",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/users-estetycloud", // ✅ liberar users-estetycloud
  "/api/users-estetycloud/", // ✅ e qualquer subrota
  "/api/companies",
  "/companies",
  "/login",
];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("config_token")?.value;
  const apiKeyHeader =
    req.headers.get("x-config-api-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const hasValidApiKey = !!process.env.CONFIG_API_KEY &&
    apiKeyHeader && apiKeyHeader.trim() === String(process.env.CONFIG_API_KEY).trim();

  // 1) HOME redirect logic
  if (pathname === "/") {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    try {
      await jwtVerify(token, key);
      return NextResponse.redirect(new URL("/tenants", req.url));
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 2) LOGIN shortcut
  if (pathname === "/login" && token) {
    try {
      await jwtVerify(token, key);
      return NextResponse.redirect(new URL("/tenants", req.url));
    } catch {}
  }

  // 3) Proteção das rotas privadas
  const isProtected =
    PROTECTED.some((p) => pathname.startsWith(p)) &&
    !EXCEPTIONS.some((e) => pathname.startsWith(e));

  // Se é uma chamada de API com x-config-api-key válida, libera sem exigir JWT
  if (pathname.startsWith("/api/") && hasValidApiKey) {
    return NextResponse.next();
  }

  if (!isProtected) {
    return NextResponse.next();
  }

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

export const config = {
  matcher: [
    "/",
    "/login",
    "/tenants/:path*",
    "/companies/:path*",
    "/api/tenants/:path*",
    "/api/companies/:path*",
    "/api/users-estetycloud/:path*", // ✅ adiciona explicitamente no matcher
  ],
};
