export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return cors(
        NextResponse.json({ valid: false, error: "email/password_required" }, { status: 400 })
      );
    }

    const db = await getDb();
    const user = await db
      .collection("users_estetycloud")
      .findOne({ email: String(email).trim().toLowerCase() });

    if (!user) return cors(NextResponse.json({ valid: false }, { status: 200 }));

    const matches = String(user.password).trim() === String(password).trim();
    const licenseStatus = String((user as any)?.license?.status || '').toLowerCase();
    const licenseValid = licenseStatus === 'active';
    return cors(
      NextResponse.json(
        {
          valid: !!matches,
          userId: user.userId || null,
          tenants: user.tenantIds || [],
          licenseStatus: licenseStatus || null,
          licenseValid,
        },
        { status: 200 }
      )
    );
  } catch (e: any) {
    console.error("[POST /validate-user] ERROR:", e);
    return cors(
      NextResponse.json({ valid: false, error: "server_error", detail: String(e) }, { status: 500 })
    );
  }
}
