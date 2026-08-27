import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KioskForm } from "@/components/checkin";
import { notFound } from "next/navigation";

export default async function KioskPage({ params }: { params: Promise<{ locationId: string }> }) {
  await requireActor();
  const { locationId } = await params;
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { branch: true },
  });
  if (!location) notFound();
  return (
    <div className="max-w-md mx-auto py-8">
      <div className="text-center mb-6">
        <div className="text-xs uppercase tracking-widest text-kampus-500">Web kiosk</div>
        <h1 className="text-2xl font-semibold mt-1">{location.name}</h1>
        <p className="text-sm text-slate-600">
          {location.branch.name} · {location.type} · RFID yerine öğrenci numarası
        </p>
      </div>
      <div className="card p-6">
        <KioskForm locationId={location.id} locationName={location.name} />
      </div>
    </div>
  );
}
