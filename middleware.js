import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = process.env.CONFIG_JWT_SECRET;
const key = new TextEncoder().encode(SECRET);

const PROTECTED = ["/tenants", "/api/tenants"];
const EXCEPTIONS = ["/api/tenants/resolve"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  const isProtected =
    PROTECTED.some(p => pathname.startsWith(p)) &&
    !EXCEPTIONS.some(e => pathname.startsWith(e));

  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("config_token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/"))
      return new NextResponse(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, key);
    return NextResponse.next();
  } catch (e) {
    if (pathname.startsWith("/api/"))
      return new NextResponse(JSON.stringify({ error: "invalid token" }), { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = { matcher: ["/tenants/:path*", "/api/tenants/:path*"] };
