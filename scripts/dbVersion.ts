// 01: scripts/dbVersion.ts
// 02:
import { PrismaClient } from "@prisma/client";
// 03:
const prisma = new PrismaClient();
// 04:
async function main() {
  // 05:
  const rows: Array<{ version: string }> = await prisma.$queryRaw`SELECT VERSION() AS version;`;
  // 06:
  console.log("DB VERSION:", rows?.[0]?.version ?? "unknown");
  // 07:
}
// 08:
main().catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
