export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.VAPID_PUBLIC_KEY || "";
  if (!raw) return new NextResponse("missing_key", { status: 500 });
  // remove aspas e quebras de linha acidentais do .env
  const key = raw.replace(/["'\s]/g, "");
  return NextResponse.json({ key }, { headers: { "cache-control": "no-store" } });
}
