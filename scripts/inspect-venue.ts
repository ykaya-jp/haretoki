import { config } from "dotenv";
config({ path: "/home/yusuke_kaya/projects/haretoki/.env.local" });
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL! } } });
async function main() {
  const ids = ["eaeff163","2cc925ca","fbfafe24","7fcd9fb0"];
  for (const prefix of ids) {
    const v = await prisma.venue.findFirst({
      where: { id: { startsWith: prefix } },
      select: { id: true, name: true, photoUrls: true, sourceUrls: true },
    });
    console.log("---", prefix, "---");
    if (v) {
      console.log("name:", v.name);
      console.log("photos:", v.photoUrls);
      console.log("sources:", v.sourceUrls);
    } else {
      console.log("NOT FOUND");
    }
  }
  await prisma.$disconnect();
}
main();
