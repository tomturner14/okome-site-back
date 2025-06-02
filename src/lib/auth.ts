import { BetterAuth } from "better-auth";
import PrismaAdapter from "better-auth/adapters/prisma";
import prisma from "./prisma.js";

export const auth = new BetterAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    cookieName: "sid",
    expiresIn: 1000 * 60 * 60 * 24 * 7 //1週間
  }
});