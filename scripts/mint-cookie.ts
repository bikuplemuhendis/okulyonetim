import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const email = process.argv[2] || "sahip@xkolej.local";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("no user " + email);
  const token = await new SignJWT({
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET || "kampus-dev-secret-change-me"));
  console.log(token);
  await prisma.$disconnect();
}

main();
