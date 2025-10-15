export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongo";

export async function GET(req, { params }) {
  const { slug } = params;

  try {
    const db = await getDb();
    const company = await db.collection("companies").findOne({ slug });

    if (!company) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json({
      _id: company._id,
      name: company.name,
      slug: company.slug,
      tenantId: company.tenantId,
      tenantName: company.tenantName,
      cidade: company.cidade,
      uf: company.uf,
      createdAt: company.createdAt,
    });
  } catch (e) {
    console.error("[GET /api/company/by-slug] DB ERROR:", e);
    return new NextResponse("Erro interno", { status: 500 });
  }
}
