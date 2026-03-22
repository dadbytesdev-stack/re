import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canExtract } from "@/lib/usage";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await canExtract(session.user.id);
  return NextResponse.json(usage);
}
