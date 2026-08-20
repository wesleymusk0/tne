"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell, MenuItem } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const SISTEMAS: Record<string, { nome: string; descricao: string; href: string; icone: string }> = {
  mapia: { nome: "MapIA", descricao: "Mapas de sala inteligentes", href: "/sistemas/mapia", icone: "🗺️" },
  horia: { nome: "HorIA", descricao: "Geração de horários", href: "/sistemas/horia", icone: "🕐" },
  somatoria: { nome: "SomatorIA", descricao: "Correção por somatória", href: "/sistemas/somatoria", icone: "🧮" },
  remanejia: { nome: "RemanejIA", descricao: "Enturmação inteligente", href: "/sistemas/remanejia", icone: "🔀" },
  buscia: { nome: "BuscIA", descricao: "Busca ativa de faltas e atrasos", href: "/sistemas/buscia", icone: "📞" },
  domicilia: { nome: "DomicilIA", descricao: "Atividades domiciliares", href: "/sistemas/domicilia", icone: "🏠" },
  notas: { nome: "Notas", descricao: "Lançamento e boletins", href: "/gestao/notas", icone: "📝" },
  presenca: { nome: "Presença", descricao: "Chamada C / F / A", href: "/gestao/presenca", icone: "✅" },
  avalia: { nome: "AvalIA", descricao: "Triagem pedagógica", href: "/sistemas/avalia", icone: "🧭" },
  provia: { nome: "ProvIA", descricao: "Montagem de provas", href: "/sistemas/provia", icone: "📄" },
  tri: { nome: "Simulador TRI", descricao: "Análise por TRI", href: "/sistemas/tri", icone: "📊" },
};

const PERIODOS = [
  { id: "dia", rotulo: "Dia" },
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
  else if (periodo === "mes") inicio.setDate(1), inicio.setHours(0, 0, 0, 0);
  else inicio.setMonth(0, 1), inicio.setHours(0, 0, 0, 0);
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

export default function DashboardPage() {
  const { perfil, tenantAtivo, setTenantAtivo } = useAuth();
  const [periodo, setPeriodo] = useState("mes");
  const [dash, setDash] = useState<Dash | null>(null);

  const sistemasDisponiveis = useMemo(() => {
    if (!perfil) return [];
    if (tenantAtivo) {
      const vinculo = perfil.vinculos[tenantAtivo];
      return (vinculo?.sistemasVisiveis ?? []).filter((s) => SISTEMAS[s]);
    }
    return perfil.plano.sistemas.filter((s) => SISTEMAS[s]);
  }, [perfil, tenantAtivo]);

  useEffect(() => {
    if (!tenantAtivo) return;
    const { inicio, fim } = janelaPeriodo(periodo);
    const qs = inicio ? `?inicio=${inicio}&fim=${fim}` : "";
    api.get<Dash & { sucesso: boolean }>(`/dashboard/${tenantAtivo}${qs}`).then(setDash).catch(() => setDash(null));
  }, [tenantAtivo, periodo]);

  const itens: MenuItem[] = useMemo(() => {
    const base: MenuItem[] = [{ href: "/dashboard", rotulo: "Dashboard", icone: "🏠" }];
    if (tenantAtivo) {
      base.push(
        { href: "/gestao/turmas", rotulo: "Turmas", icone: "🏫" },
        { href: "/gestao/alunos", rotulo: "Alunos", icone: "🎓" },
        { href: "/gestao/presenca", rotulo: "Presença", icone: "✅" },
        { href: "/gestao/notas", rotulo: "Notas e Boletins", icone: "📝" },
        { href: "/instituicao", rotulo: "Instituição", icone: "⚙️" }
      );
    }
    base.push({ href: "/assinatura", rotulo: "Assinatura", icone: "💳" });
    if (perfil?.adminGlobal) base.push({ href: "/admin", rotulo: "Administração Global", icone: "🌐" });
    return base;
  }, [tenantAtivo, perfil?.adminGlobal]);

  return (
    <AppShell titulo="Dashboard" itens={itens}>
      {Object.keys(perfil?.vinculos ?? {}).length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Contexto:</label>
          <select
            value={tenantAtivo ?? ""}
            onChange={(e) => setTenantAtivo(e.target.value || null)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Conta individual</option>
            {Object.entries(perfil?.vinculos ?? {}).map(([id, v]) => (
              <option key={id} value={id}>
                {v.instituicao ?? id}
              </option>
            ))}
          </select>
        </div>
      )}

      {tenantAtivo && (
        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  periodo === p.id ? "bg-blue-100 text-blue-800" : "text-slate-600 hover:bg-slate-100"
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
              <div key={c.rotulo} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-2xl font-semibold text-slate-900">{c.valor ?? "—"}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.rotulo}</div>
              </div>
            ))}
          </div>
          {(dash?.indicadores.notas || dash?.indicadores.domicilia) && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {dash.indicadores.notas && (
                <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-700">
                  Média geral das notas: <strong>{dash.indicadores.notas.mediaGeral}</strong> ({dash.indicadores.notas.lancamentos} lançamentos)
                </div>
              )}
              {dash.indicadores.domicilia && (
                <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-700">
                  Atividades domiciliares pendentes: <strong>{dash.indicadores.domicilia.pendentes}</strong> de {dash.indicadores.domicilia.total}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Sistemas</h2>
        {sistemasDisponiveis.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            Nenhum sistema disponível neste contexto. Verifique seu plano ou os sistemas contratados pela instituição.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sistemasDisponiveis.map((id) => {
              const s = SISTEMAS[id];
              return (
                <Link
                  key={id}
                  href={s.href}
                  className="group rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="text-2xl" aria-hidden>{s.icone}</div>
                  <div className="mt-2 font-semibold text-slate-900 group-hover:text-primary-600">{s.nome}</div>
                  <div className="text-sm text-slate-500">{s.descricao}</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
