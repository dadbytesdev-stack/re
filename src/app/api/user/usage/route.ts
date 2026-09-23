import { NextRequest, NextResponse } from "next/server";
import { canExtract } from "@/lib/usage";
import { getAuthUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await canExtract(user.id);

  // JSON has no Infinity — it serialises to null — so send the unlimited
  // tiers as an explicit null and let the client read that as "no limit".
  return NextResponse.json({
    ...usage,
    limit: Number.isFinite(usage.limit) ? usage.limit : null,
  });
}
