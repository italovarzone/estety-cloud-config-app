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
    const { email, oldPassword, newPassword } = await req.json();
    if (!email || !newPassword) {
      return cors(
        NextResponse.json({ success: false, error: "missing_params" }, { status: 400 })
      );
    }

    if (String(newPassword).trim().length < 6) {
      return cors(
        NextResponse.json({ success: false, error: "weak_password" }, { status: 400 })
      );
    }

    const db = await getDb();
    const emailNorm = String(email).trim().toLowerCase();
    const user = await db.collection("users_estetycloud").findOne({ email: emailNorm });

    if (!user) {
      return cors(NextResponse.json({ success: false, error: "not_found" }, { status: 404 }));
    }

    if (oldPassword != null) {
      const matches = String(user.password).trim() === String(oldPassword).trim();
      if (!matches) {
        return cors(
          NextResponse.json({ success: false, error: "invalid_old_password" }, { status: 401 })
        );
      }
    }

    await db.collection("users_estetycloud").updateOne(
      { email: emailNorm },
      { $set: { password: String(newPassword).trim(), updatedAt: new Date() } }
    );

    return cors(NextResponse.json({ success: true }, { status: 200 }));
  } catch (e: any) {
    console.error("[POST /change-password] ERROR:", e);
    return cors(
      NextResponse.json({ success: false, error: "server_error", detail: String(e) }, { status: 500 })
    );
  }
}
