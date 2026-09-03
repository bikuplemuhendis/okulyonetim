import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-[var(--kampus-950)] text-white p-12">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-teal-200/80">Kampüs OS</div>
          <h1 className="text-4xl font-semibold mt-3 leading-tight">K12NET’i geçen modern okul işletim sistemi</h1>
          <p className="mt-4 text-white/70 max-w-md">
            Not, ödev, veli 360°, ücret, servis, etüt ve canlı kampüs — tek arayüz, RFID’siz.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-white/80">
          <li>• Akademik + finans + operasyon süiti</li>
          <li>• Veli/öğrenci portalları birinci sınıf</li>
          <li>• Canlı bina, kiosk, KVKK, audit</li>
        </ul>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="card w-full max-w-md p-8">
          <h2 className="text-xl font-semibold mb-1">KampüsTakip girişi</h2>
          <p className="text-sm text-slate-600 mb-6">E-posta ve parola ile oturum açın.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
