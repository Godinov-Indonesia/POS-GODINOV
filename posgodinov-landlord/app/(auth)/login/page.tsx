"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "@/components/ui/feedback";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Email dan password wajib diisi");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.message || "Email atau password salah");
      }

      toast.success("Login berhasil! Mengalihkan...");
      router.push(fromUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat login";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-bold tracking-tight text-fg">
          Masuk ke Landlord Console
        </h1>
        <p className="text-xs text-fg-muted">
          Pusat kendali ekosistem SaaS dan administrasi tenant POS-GODINOV.
        </p>
      </div>

      {errorMsg && (
        <Banner tone="danger">
          <span>{errorMsg}</span>
        </Banner>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1.5">
            Email Administrator
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-fg-subtle">
              <Mail className="size-4" />
            </div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@godinov.com"
              autoComplete="email"
              required
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-fg-subtle">
              <Lock className="size-4" />
            </div>
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="pl-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-fg-subtle hover:text-fg transition-colors"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        block
        disabled={loading}
      >
        <span>{loading ? "Memverifikasi..." : "Masuk ke Console"}</span>
        {!loading && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-surface">
      {/* Panel kiri: Logo + Formulir */}
      <div className="flex w-full flex-col overflow-y-auto lg:w-1/2">
        <div className="shrink-0 px-6 pt-8 sm:px-10 lg:px-16">
          <Logo priority className="h-10" />
        </div>

        <div className="flex flex-1 items-center px-6 py-8 sm:px-10 lg:px-16">
          <div className="mx-auto w-full max-w-sm">
            <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-xl bg-bg-muted" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <div className="p-6 text-center text-xs text-fg-subtle">
          POS-GODINOV Platform &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* Panel kanan: Hero Navy khas Godinov FE */}
      <div className="relative hidden flex-col justify-between overflow-hidden rounded-l-[3rem] bg-surface-inverse px-16 pt-16 pb-12 lg:flex lg:w-1/2">
        <div className="relative z-10">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent-subtle/20 border border-accent/30 px-2 py-0.5 rounded mb-4">
            Superadmin Control Plane
          </span>
          <h2 className="max-w-md text-2xl font-bold leading-snug text-fg-inverse">
            Kelola seluruh ekosistem bisnis dan infrastruktur secara terpadu.
          </h2>
          <p className="mt-3 max-w-md text-xs text-fg-inverse/70 leading-relaxed">
            Pantau pertumbuhan merchant, konfigurasi paket SaaS & kuota limit, kelola backup snapshot, serta audit seluruh aktivitas platform.
          </p>
        </div>

        <div className="relative z-10 flex justify-center py-6">
          <Image
            src="/images/ilustrasi.png"
            alt="Godinov Landlord"
            width={480}
            height={320}
            className="w-auto h-64 object-contain"
            priority
          />
        </div>

        <div className="relative z-10 border-t border-border-inverse pt-4 flex items-center justify-between text-xs text-fg-inverse/60">
          <span>SaaS Management Platform</span>
          <span className="font-mono text-[11px]">v1.0-RELEASE</span>
        </div>
      </div>
    </main>
  );
}
