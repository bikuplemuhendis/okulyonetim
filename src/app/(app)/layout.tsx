import { requireActor } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const tenants =
    actor.role === "PLATFORM_SUPER_ADMIN"
      ? await prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [];
  return (
    <AppShell actor={actor} nav={navFor(actor.role)} tenants={tenants}>
      {children}
    </AppShell>
  );
}
