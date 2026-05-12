import { NextRequest, NextResponse } from "next/server";
import { canExtract } from "@/lib/usage";
import { getAuthUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await canExtract(user.id);
  return NextResponse.json(usage);
}
