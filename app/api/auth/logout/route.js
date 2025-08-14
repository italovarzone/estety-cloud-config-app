import { NextResponse } from "next/server";
export async function GET(req) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set("config_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
