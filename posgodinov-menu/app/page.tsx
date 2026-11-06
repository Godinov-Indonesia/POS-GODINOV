import { QrCode } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 shadow-sm border border-blue-100">
        <QrCode className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
        Godinov Menu
      </h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
        Pindai kode QR yang tersedia di meja atau outlet untuk mulai memilih menu dan memesan langsung dari ponsel Anda.
      </p>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Sistem Siap Digunakan
      </div>
    </main>
  );
}
