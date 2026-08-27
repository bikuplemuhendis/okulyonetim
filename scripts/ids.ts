import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const s = await p.student.findFirst({ where: { studentNo: "202612008" } });
  const loc = await p.location.findFirst({ where: { name: "12-A Kapısı" } });
  const sess = await p.lessonSession.findFirst({ where: { status: "OPEN" } });
  console.log(JSON.stringify({ studentId: s?.id, locationId: loc?.id, sessionId: sess?.id }));
  await p.$disconnect();
}
main();
