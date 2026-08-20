"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icone } from "@/lib/icones";
import { useMenuItens } from "@/lib/menu";
import { ORDEM_SISTEMAS, SISTEMAS } from "@/lib/sistemas";

const PERIODOS = [
  { id: "dia", rotulo: "Hoje" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
  { id: "ano", rotulo: "Ano letivo" },
  { id: "tudo", rotulo: "Tudo" },
];

function janelaPeriodo(periodo: string): { inicio?: number; fim?: number } {
  if (periodo === "tudo") return {};
  const agora = new Date();
  const inicio = new Date(agora);
  if (periodo === "dia") inicio.setHours(0, 0, 0, 0);
  else if (periodo === "semana") inicio.setDate(agora.getDate() - 7);
  else if (periodo === "mes") {
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
  } else {
    inicio.setMonth(0, 1);
    inicio.setHours(0, 0, 0, 0);
  }
  return { inicio: inicio.getTime(), fim: agora.getTime() };
}

interface Dash {
  resumo: { alunos: number; turmas: number; professores: number };
  indicadores: {
    presenca?: { compareceram: number; faltas: number; atrasos: number };
    domicilia?: { pendentes: number; total: number };
    notas?: { mediaGeral: number; lancamentos: number };
  };
}

const ROTULOS_PLANO: Record<string, string> = {
  free: "FREE",
  essencial: "ESSENCIAL",
  profissional: "PROFISSIONAL",
  escola: "ESCOLA",
};

export default function DashboardPage() {
  const { perfil, tenantAtivo, setTenantAtivo, recarregarPerfil } = useAuth();
  const [periodo, setPeriodo] = useState("mes");
  const [dash, setDash] = useState<Dash | null>(null);
  const itens = useMenuItens(perfil, tenantAtivo);

  // Separação de contextos (TNE §3): pessoal = plano da assinatura; institucional = vínculo.
  // perfil null = indeterminado (não rotular como bloqueado).
  const { liberados, bloqueados, indeterminados } = useMemo(() => {
    if (!perfil) {
      return { liberados: [], bloqueados: [], indeterminados: ORDEM_SISTEMAS };
    }
    if (tenantAtivo) {
      const vis = new Set(perfil.vinculos[tenantAtivo]?.sistemasVisiveis ?? []);
      return {
        liberados: ORDEM_SISTEMAS.filter((s) => vis.has(s)),
        bloqueados: ORDEM_SISTEMAS.filter((s) => !vis.has(s)),
        indeterminados: [],
      };
    }
    const plano = new Set(perfil.plano.sistemas ?? []);
    return {
      liberados: ORDEM_SISTEMAS.filter((s) => plano.has(s)),
      bloqueados: ORDEM_SISTEMAS.filter((s) => !plano.has(s)),
      indeterminados: [],
    };
  }, [perfil, tenantAtivo]);

  useEffect(() => {
    if (!tenantAtivo) {
      setDash(null);
      return;
    }
    const { inicio, fim } = janelaPeriodo(periodo);
    const qs = inicio ? `?inicio=${inicio}&fim=${fim}` : "";
    api.get<Dash & { sucesso: boolean }>(`/dashboard/${tenantAtivo}${qs}`).then(setDash).catch(() => setDash(null));
  }, [tenantAtivo, periodo]);

  const perfilErro = perfil === null;

  return (
    <AppShell titulo="Dashboard" itens={itens}>
      {perfilErro && (
        <div className="mb-6 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Não foi possível carregar seu perfil agora.</span>
          <button onClick={() => recarregarPerfil()} className="rounded-md border border-amber-300 px-3 py-1 font-medium hover:bg-amber-100">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Seletor de contexto: pessoal (padrão) ou instituição */}
      {Object.keys(perfil?.vinculos ?? {}).length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-600" htmlFor="ctx">Contexto</label>
          <select
            id="ctx"
            value={tenantAtivo ?? ""}
            onChange={(e) => setTenantAtivo(e.target.value || null)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Perfil pessoal{perfil ? ` (${ROTULOS_PLANO[perfil.plano.tipo] ?? perfil.plano.tipo})` : ""}</option>
            {Object.entries(perfil?.vinculos ?? {}).map(([id, v]) => (
              <option key={id} value={id}>
                {v.instituicao ?? id}
              </option>
            ))}
          </select>
          {tenantAtivo && (
            <span className="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              Plano Escola · sistemas contratados
            </span>
          )}
          {!tenantAtivo && perfil && (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Assinatura individual · {ROTULOS_PLANO[perfil.plano.tipo] ?? perfil.plano.tipo}
            </span>
          )}
        </div>
      )}

      {/* Indicadores institucionais com seleção de período */}
      {tenantAtivo && (
        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white p-1 w-fit">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  periodo === p.id ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { rotulo: "Alunos", valor: dash?.resumo.alunos },
              { rotulo: "Turmas", valor: dash?.resumo.turmas },
              { rotulo: "Professores", valor: dash?.resumo.professores },
              { rotulo: "Presenças", valor: dash?.indicadores.presenca?.compareceram },
              { rotulo: "Faltas", valor: dash?.indicadores.presenca?.faltas },
              { rotulo: "Atrasos", valor: dash?.indicadores.presenca?.atrasos },
            ].map((c) => (
              <div key={c.rotulo} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                <div className="text-xl font-semibold tabular-nums text-slate-900">{c.valor ?? "—"}</div>
                <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{c.rotulo}</div>
              </div>
            ))}
          </div>
          {(dash?.indicadores.notas || dash?.indicadores.domicilia) && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {dash.indicadores.notas && (
                <div className="rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  Média geral das notas: <strong className="tabular-nums">{dash.indicadores.notas.mediaGeral}</strong>
                  <span className="text-slate-500"> · {dash.indicadores.notas.lancamentos} lançamentos</span>
                </div>
              )}
              {dash.indicadores.domicilia && (
                <div className="rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  Atividades domiciliares pendentes: <strong className="tabular-nums">{dash.indicadores.domicilia.pendentes}</strong>
                  <span className="text-slate-500"> de {dash.indicadores.domicilia.total}</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Catálogo de sistemas: disponíveis + bloqueados */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {tenantAtivo ? "Sistemas da instituição" : "Meus sistemas"}
          </h2>
          {!tenantAtivo && (
            <Link href="/assinatura" className="text-xs font-medium text-primary hover:underline">
              Gerenciar assinatura
            </Link>
          )}
        </div>

        {liberados.length === 0 && bloqueados.length === 0 && !perfilErro ? (
          <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            Nenhum sistema disponível neste contexto.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {liberados.map((id) => {
              const s = SISTEMAS[id];
              return (
                <Link
                  key={id}
                  href={s.href}
                  className="group flex flex-col rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-primary-100 hover:bg-primary-50/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary">
                      <Icone nome={s.icone} className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600">Disponível</span>
                  </div>
                  <div className="mt-3 font-semibold text-slate-900 group-hover:text-primary-700">{s.nome}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{s.descricao}</div>
                </Link>
              );
            })}
            {indeterminados.map((id) => {
              const s = SISTEMAS[id];
              return (
                <div key={id} className="flex flex-col rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                      <Icone nome={s.icone} className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">Verificando acesso...</span>
                  </div>
                  <div className="mt-3 font-semibold text-slate-600">{s.nome}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{s.descricao}</div>
                </div>
              );
            })}
            {bloqueados.map((id) => {
              const s = SISTEMAS[id];
              const destino = tenantAtivo ? null : "/assinatura";
              const conteudo = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                      <Icone nome={s.icone} className="h-5 w-5" />
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3" aria-hidden>
                        <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
                        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                      </svg>
                      {tenantAtivo ? "Não contratado" : "Bloqueado"}
                    </span>
                  </div>
                  <div className="mt-3 font-semibold text-slate-400">{s.nome}</div>
                  <div className="mt-0.5 text-sm text-slate-400">{s.descricao}</div>
                  {!tenantAtivo && (
                    <div className="mt-2 text-xs font-medium text-primary">Disponível em outro plano</div>
                  )}
                </>
              );
              return destino ? (
                <Link key={id} href={destino} className="flex flex-col rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-4">
                  {conteudo}
                </Link>
              ) : (
                <div key={id} className="flex flex-col rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-4">
                  {conteudo}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
