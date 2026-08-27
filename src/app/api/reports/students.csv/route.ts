import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canExport, tenantFilter } from "@/lib/rbac";
import { loadTenant, maskForActor } from "@/lib/services";

export async function GET() {
  const actor = await getActor();
  if (!actor || !canExport(actor.role)) {
    return new NextResponse("Yetkisiz", { status: 401 });
  }
  const tenant = await loadTenant(actor);
  const students = await prisma.student.findMany({
    where: tenantFilter(actor),
    include: { classroom: true, branch: true, parents: { include: { parent: true } } },
  });
  const header = "ogrenci_no,ad,sinif,sube,veli_ad,veli_telefon,veli_eposta,durum";
  const lines = students.map((s) => {
    const p = s.parents[0]?.parent;
    const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", { phone: p?.phone, email: p?.email });
    return [s.studentNo, s.name, s.classroom.name, s.branch.code, p?.name ?? "", masked.phone, masked.email, s.status]
      .map((x) => `"${String(x).replaceAll('"', '""')}"`)
      .join(",");
  });
  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=ogrenciler.csv",
    },
  });
}
