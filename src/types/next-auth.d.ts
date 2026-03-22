import { Tier } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      tier: Tier;
      extractionsUsed: number;
      usageResetAt: Date;
    };
  }

  interface User {
    tier?: Tier;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tier?: Tier;
    extractionsUsed?: number;
    usageResetAt?: Date;
  }
}
