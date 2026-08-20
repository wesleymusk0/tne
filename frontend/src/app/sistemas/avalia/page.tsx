"use client";

import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const AREAS: { id: string; nome: string; max: number }[] = [
  { id: "tea", nome: "Transtorno do Espectro Autista (TEA)", max: 30 },
  { id: "tdah", nome: "TDAH", max: 30 },
  { id: "di", nome: "Deficiência Intelectual (DI)", max: 30 },
  { id: "ah", nome: "Altas Habilidades / Superdotação (AH/SD)", max: 30 },
  { id: "dislexia", nome: "Dislexia", max: 20 },
  { id: "discalculia", nome: "Discalculia", max: 20 },
  { id: "tod", nome: "Transtorno Opositor Desafiador (TOD)", max: 20 },
];

const OPCOES = [
  { valor: 0, rotulo: "0 — Nunca" },
  { valor: 1, rotulo: "1 — Raramente" },
  { valor: 2, rotulo: "2 — Frequentemente" },
  { valor: 3, rotulo: "3 — Sempre" },
];

interface ResultadoAvalia {
  resultados: Record<string, { nivel: string; classeCSS: string; recomendacoes: string | string[] }>;
}

export default function AvaliaPage() {
  const { tenantAtivo } = useAuth();
  const [aluno, setAluno] = useState("");
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<ResultadoAvalia["resultados"] | null>(null);
  const [msg, setMsg] = useState("");
  const [gerando, setGerando] = useState(false);

  const menuItens = [
    { href: "/dashboard", rotulo: "Dashboard", icone: "🏠" },
    { href: "/sistemas/avalia", rotulo: "AvalIA", icone: "🧭" },
  ];

  async function gerar() {
    setGerando(true);
    setMsg("");
    try {
      const ponstuacoes: Record<string, number> = {};
      const maximas: Record<string, number> = {};
      for (const area of AREAS) {
        ponstuacoes[area.id] = respostas[area.id] ?? 0;
        maximas[area.id] = area.max;
      }
      // a triagem conta como projeto (regras/cotas institucionais + plano)
      const proj = await api.post<{ projetoId: string }>("/projetos/avalia", {
        tenantId: tenantAtivo ?? undefined,
        nome: `Triagem ${aluno || "aluno"}`,
      });
      const r = await api.post<ResultadoAvalia>("/engines/avalia/gerar", {
        tenantId: tenantAtivo ?? undefined,
        projetoId: proj.projetoId,
        pontuacoes: ponstuacoes,
        maximas,
      });
      setResultado(r.resultados);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao gerar triagem.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <AppShell titulo="AvalIA — Triagem Pedagógica" itens={menuItens}>
      <div className="max-w-3xl">
        <p className="mb-4 text-sm text-slate-600">
          Ferramenta de triagem inicial (rastreio), não substitui avaliação profissional. Responda com base na observação do comportamento do aluno.
        </p>
        <input
          className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Nome do aluno (opcional)"
          value={aluno}
          onChange={(e) => setAluno(e.target.value)}
        />
        <div className="flex flex-col gap-4">
          {AREAS.map((area) => (
            <div key={area.id} className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-medium text-slate-900">{area.nome}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-500">Pontuação (0–{area.max})</span>
                <input
                  className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-center text-sm"
                  inputMode="numeric"
                  value={respostas[area.id] ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    setRespostas({ ...respostas, [area.id]: Math.min(area.max, Math.max(0, Number(e.target.value) || 0)) })
                  }
                />
                <span className="text-xs text-slate-400">máx. {area.max}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={gerar} disabled={gerando} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60">
            {gerando ? "Gerando..." : "Gerar relatório de triagem"}
          </button>
          {msg && <span className="text-sm text-red-600">{msg}</span>}
        </div>

        {resultado && (
          <div className="mt-6 flex flex-col gap-3">
            {AREAS.map((area) => {
              const r = resultado[area.id];
              if (!r) return null;
              const cor = r.nivel === "Alto" ? "bg-red-50 text-red-800 border-red-200" : r.nivel === "Moderado" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-green-50 text-green-800 border-green-200";
              return (
                <div key={area.id} className={`rounded-xl border p-4 ${cor}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{area.nome}</h3>
                    <span className="rounded-full bg-white/70 px-3 py-0.5 text-xs font-semibold">{r.nivel}</span>
                  </div>
                  {Array.isArray(r.recomendacoes) ? (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {r.recomendacoes.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm">{r.recomendacoes}</p>
                  )}
                </div>
              );
            })}
            <button onClick={() => window.print()} className="w-fit rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Imprimir relatório
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
