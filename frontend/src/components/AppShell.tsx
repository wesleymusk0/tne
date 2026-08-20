"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { Icone, IconeNome } from "@/lib/icones";

export interface MenuItem {
  href: string;
  rotulo: string;
  icone: IconeNome;
}

export function Logo({ altura = 30, claro = false }: { altura?: number; claro?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 select-none">
      <Image
        src="/systematrix.jpg"
        alt="Systematrix"
        width={altura}
        height={altura}
        className="rounded"
        priority
      />
      <span className={`text-base font-semibold tracking-tight ${claro ? "text-white" : "text-slate-900"}`}>
        Systematrix
      </span>
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
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
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
            <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 sm:block">
              {vinculoAtivo.instituicao ?? tenantAtivo}
            </span>
          )}
          <span className="hidden text-slate-600 sm:block">{perfil?.nome ?? perfil?.email}</span>
          <button
            onClick={() => sair().then(() => router.replace("/login"))}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex pt-14">
        <aside
          className={`fixed bottom-0 left-0 top-14 z-20 w-60 transform border-r border-slate-200 bg-white transition-transform md:translate-x-0 ${
            menuAberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-0.5 p-3">
            {itens.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuAberto(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  aria-current={ativo ? "page" : undefined}
                >
                  <Icone nome={item.icone} className={`h-[18px] w-[18px] ${ativo ? "text-primary" : "text-slate-400"}`} />
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
          <h1 className="mb-1 text-lg font-semibold text-slate-900">{titulo}</h1>
          <div className="mb-6 h-px w-full bg-slate-100" />
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
      <div className="w-full max-w-sm rounded-md bg-white p-6 shadow-xl">
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
