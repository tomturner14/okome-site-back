import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieName: "better-auth.session-token",
  },
  baseURL: process.env.BASE_URL || "http://localhost:4000",
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-here",
  trustedOrigins: ["http://localhost:4000"],
});

console.log("Better Auth initialized successfully");