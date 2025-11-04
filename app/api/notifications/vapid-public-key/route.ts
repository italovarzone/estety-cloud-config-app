export const runtime = "nodejs";

import { NextResponse } from "next/server";

// Web Push removido — endpoint desativado.
export async function GET() {
  return new NextResponse("web-push disabled", { status: 410 });
}
