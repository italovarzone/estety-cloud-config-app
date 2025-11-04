export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { saveSubscription } from "../../../../lib/push";

export async function POST(req: Request) {
  try {
    const sub = await req.json();
    if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ ok: false, error: "invalid_subscription" }, { status: 400 });
    }
    await saveSubscription(sub);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
