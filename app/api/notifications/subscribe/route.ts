export const runtime = "nodejs";

import { NextResponse } from "next/server";

// Web Push removido — endpoint desativado.
export async function POST() {
  return new NextResponse("web-push disabled", { status: 410 });
}
