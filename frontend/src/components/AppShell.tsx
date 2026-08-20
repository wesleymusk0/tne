"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";

export interface MenuItem {
  href: string;
  rotulo: string;
  icone: string;
}

export function Logo({ altura = 34 }: { altura?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 select-none">
      <Image
        src="/systematrix.jpg"
        alt="Systematrix"
        width={altura}
        height={altura}
        className="rounded-md"
        priority
      />
      <span className="text-lg font-semibold tracking-tight text-white">Systematrix</span>
    </Link>
  );
}

export function AppShell({
  titulo,
  itens,
  children,
}: {
  titulo: string;
  itens: MenuItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { firebaseUser, perfil, carregando, sair, tenantAtivo } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!carregando && !firebaseUser) router.replace("/login");
  }, [carregando, firebaseUser, router]);

  if (carregando || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-accent" />
      </div>
    );
  }

  const vinculoAtivo = tenantAtivo ? perfil?.vinculos[tenantAtivo] : undefined;

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-primary px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            className="rounded p-1.5 text-white hover:bg-white/10 md:hidden"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Abrir menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-3 text-sm">
          {vinculoAtivo && (
            <span className="hidden rounded bg-white/10 px-2 py-1 text-white sm:block">
              {vinculoAtivo.instituicao ?? tenantAtivo}
            </span>
          )}
          <span className="hidden text-white/80 sm:block">{perfil?.nome ?? perfil?.email}</span>
          <button
            onClick={() => sair().then(() => router.replace("/login"))}
            className="rounded bg-white/10 px-3 py-1.5 text-white hover:bg-white/20"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex pt-14">
        <aside
          className={`fixed bottom-0 left-0 top-14 z-20 w-60 transform border-r border-slate-100 bg-white transition-transform md:translate-x-0 ${
            menuAberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-1 p-3">
            {itens.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuAberto(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-blue-100 text-blue-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  aria-current={ativo ? "page" : undefined}
                >
                  <span aria-hidden className="text-base">{item.icone}</span>
                  <span>{item.rotulo}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        {menuAberto && (
          <div
            className="fixed inset-0 top-14 z-10 bg-black/20 md:hidden"
            onClick={() => setMenuAberto(false)}
          />
        )}
        <main className="min-h-[calc(100vh-3.5rem)] w-full p-4 md:ml-60 md:p-8">
          <h1 className="mb-6 text-xl font-semibold text-slate-900">{titulo}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}

export function ConfirmarAcao({
  aberto,
  mensagem,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  mensagem?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">Confirmação</h2>
        <p className="mt-2 text-sm text-slate-600">
          {mensagem ?? "Você tem certeza que deseja realizar esta ação?"}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancelar} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
