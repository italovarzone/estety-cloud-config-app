// app/api/auth/whoami/route.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const key = new TextEncoder().encode(process.env.CONFIG_JWT_SECRET);

export async function GET(req) {
  const cookie = req.headers.get("cookie") || "";
  const token = (cookie.match(/(?:^|;)\s*config_token=([^;]+)/)?.[1]) || null;
  if (!token) return NextResponse.json({ ok: false, reason: "no-cookie" }, { status: 401 });

  try {
    const { payload } = await jwtVerify(decodeURIComponent(token), key);
    return NextResponse.json({ ok: true, payload });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: "invalid", error: String(e) }, { status: 401 });
  }
}
