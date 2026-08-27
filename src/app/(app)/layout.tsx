import { requireActor } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return (
    <AppShell actor={actor} nav={navFor(actor.role)}>
      {children}
    </AppShell>
  );
}
