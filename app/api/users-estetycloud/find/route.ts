export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongo";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "email/password_required" }, { status: 400 });

    const db = await getDb();
    const user = await db
      .collection("users_estetycloud")
      .findOne({ email: String(email).trim().toLowerCase() });

    if (!user)
      return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Verifica a senha manualmente
    if (String(user.password).trim() !== String(password).trim()) {
      return NextResponse.json({ error: "invalid_password" }, { status: 401 });
    }

    // Retorna o usuário completo, incluindo senha (caso precise)
    return NextResponse.json({
      userId: user.userId,
      email: user.email,
      tenantIds: user.tenantIds,
      directives: user.directives || [],
      password: user.password, // 👈 agora vem garantido
      type: user.type || 0,
    });
  } catch (e) {
    console.error("[POST /find-user] ERROR:", e);
    return NextResponse.json({ error: "server_error", detail: String(e) }, { status: 500 });
  }
}
