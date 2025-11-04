export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  const pub = process.env.VAPID_PUBLIC_KEY || "";
  if (!pub) return new NextResponse("missing_key", { status: 500 });
  return NextResponse.json({ key: pub }, { headers: { "cache-control": "no-store" } });
}
