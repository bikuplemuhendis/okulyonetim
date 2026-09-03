import { requireActor } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { localePack, localizeNav } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const tenants =
    actor.role === "PLATFORM_SUPER_ADMIN"
      ? await prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, vertical: true } })
      : [];
  const tenant = actor.tenantId
    ? await prisma.tenant.findUnique({ where: { id: actor.tenantId }, select: { vertical: true } })
    : null;
  const vertical = tenant?.vertical ?? "KAMPUS";
  return (
    <AppShell actor={actor} nav={localizeNav(navFor(actor.role), vertical)} tenants={tenants} locale={localePack(vertical)}>
      {children}
    </AppShell>
  );
}
