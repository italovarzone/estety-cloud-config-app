import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongo";

export async function GET(req, { params }) {
  const slug = params.slug.toLowerCase();
  const db = await getDb();
  const company = await db.collection("companies").findOne({
    slug: slug
  });
  if (!company) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(company);
}
