import { NextResponse } from "next/server";
import { clearAuthCookie } from "../../../../lib/auth";

export async function GET() {
  clearAuthCookie();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:4000"));
}
