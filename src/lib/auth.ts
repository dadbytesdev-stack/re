import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Tier } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/dashboard",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.tier = (user as { tier?: Tier }).tier ?? "FREE";
      }

      // Allow client-side updates (e.g. after subscription change)
      if (trigger === "update" && session?.tier) {
        token.tier = session.tier;
      }

      // Refresh tier from DB on each JWT refresh
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tier: true, extractionsUsed: true, usageResetAt: true },
        });
        if (dbUser) {
          token.tier = dbUser.tier;
          token.extractionsUsed = dbUser.extractionsUsed;
          token.usageResetAt = dbUser.usageResetAt;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.tier = token.tier as Tier;
        session.user.extractionsUsed = token.extractionsUsed as number;
        session.user.usageResetAt = token.usageResetAt as Date;
      }
      return session;
    },
  },
};
