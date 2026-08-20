"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMenuItens } from "@/lib/menu";

interface Turma {
  id: string;
  nome: string;
}

interface Aluno {
  id: string;
  nome: string;
  numeroChamada?: number;
}

interface Componente {
  id: string;
  nome: string;
  pontos: number;
}

interface ConfigAvaliacao {
  escala: string;
  componentes: Componente[];
  media: string;
}

interface NotaRegistro {
  componentes: Record<string, number>;
  total: number;
}

interface Boletim {
  instituicao?: string;
  aluno: { nome?: string; matricula?: string };
  periodo: string;
  config: ConfigAvaliacao;
  linhas: { disciplina: string; componentes: Record<string, number>; total: number }[];
}

export default function NotasPage() {
  const { perfil, tenantAtivo } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const ano = new Date().getFullYear();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [periodo, setPeriodo] = useState(`${ano}-T1`);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [config, setConfig] = useState<ConfigAvaliacao | null>(null);
  const [notas, setNotas] = useState<Record<string, Record<string, number>>>({});
  const [msg, setMsg] = useState("");
  const [boletim, setBoletim] = useState<Boletim | null>(null);

  useEffect(() => {
    if (!tenantAtivo) return;
    api.get<{ turmas: Turma[] }>(`/academico/${tenantAtivo}/turmas`).then((r) => {
      setTurmas(r.turmas);
      setTurmaId((atual) => atual || r.turmas[0]?.id || "");
    }).catch(() => undefined);
    api.get<{ config: ConfigAvaliacao }>(`/academico/${tenantAtivo}/config-avaliacao`)
      .then((r) => setConfig(r.config))
      .catch(() =>
        setConfig({
          escala: "0-100",
          media: "aritmetica",
          componentes: [
            { id: "AV1", nome: "Avaliação 1", pontos: 20 },
            { id: "AV2", nome: "Trabalho individual", pontos: 10 },
            { id: "AV3", nome: "Prova trimestral", pontos: 50 },
            { id: "AV4", nome: "Trabalho em grupo", pontos: 20 },
          ],
        })
      );
  }, [tenantAtivo]);

  const carregar = useCallback(() => {
    if (!tenantAtivo || !turmaId || !disciplina) {
      setAlunos([]);
      return;
    }
    api.get<{ alunos: Aluno[] }>(`/academico/${tenantAtivo}/alunos?turmaId=${turmaId}`).then((r) => setAlunos(r.alunos)).catch(() => undefined);
    api
      .get<{ notas: Record<string, NotaRegistro> }>(`/academico/${tenantAtivo}/notas/${periodo}/${turmaId}/${encodeURIComponent(disciplina)}`)
      .then((r) => {
        const inicial: Record<string, Record<string, number>> = {};
        for (const [alunoId, reg] of Object.entries(r.notas)) inicial[alunoId] = reg.componentes ?? {};
        setNotas(inicial);
      })
      .catch(() => setNotas({}));
  }, [tenantAtivo, turmaId, disciplina, periodo]);

  useEffect(carregar, [carregar]);

  function definirNota(alunoId: string, compId: string, valor: string, max: number) {
    const numero = valor === "" ? NaN : Number(valor.replace(",", "."));
    setNotas((prev) => {
      const atual = { ...(prev[alunoId] ?? {}) };
      if (Number.isNaN(numero)) delete atual[compId];
      else atual[compId] = Math.min(Math.max(0, numero), max);
      return { ...prev, [alunoId]: atual };
    });
  }

  async function salvarAluno(alunoId: string) {
    if (!tenantAtivo || !disciplina) return;
    setMsg("");
    try {
      const r = await api.put<{ total: number }>(
        `/academico/${tenantAtivo}/notas/${periodo}/${turmaId}/${encodeURIComponent(disciplina)}/${alunoId}`,
        { componentes: notas[alunoId] ?? {} }
      );
      setMsg(`Notas salvas. Total: ${r.total}`);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao salvar notas.");
    }
  }

  async function emitirBoletim(alunoId: string) {
    if (!tenantAtivo) return;
    try {
      const r = await api.get<{ boletim: Boletim }>(`/academico/${tenantAtivo}/boletim/${periodo}/${alunoId}`);
      setBoletim(r.boletim);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao emitir boletim.");
    }
  }

  if (!tenantAtivo) {
    return (
      <AppShell titulo="Notas" itens={itens}>
        <p className="text-sm text-slate-500">Selecione uma instituição no Dashboard.</p>
      </AppShell>
    );
  }

  const campo = "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent";
  const componentes = config?.componentes ?? [];

  return (
    <AppShell titulo="Notas e Boletins" itens={itens}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={campo} value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        <input
          className={campo}
          placeholder="Disciplina (ex.: Matemática)"
          value={disciplina}
          onChange={(e) => setDisciplina(e.target.value)}
        />
        <select className={campo} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {["T1", "T2", "T3", "T4"].map((t) => (
            <option key={t} value={`${ano}-${t}`}>{ano} · {t}</option>
          ))}
        </select>
        {config && (
          <span className="text-xs text-slate-500">
            Escala {config.escala} · {componentes.map((c) => `${c.id} (${c.pontos})`).join(" + ")}
          </span>
        )}
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>

      {!disciplina ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Informe a disciplina para lançar notas. O vínculo professor–disciplina–turma pode ser derivado do horário institucional (HorIA).
        </p>
      ) : alunos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Nenhum aluno nesta turma.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Aluno</th>
                {componentes.map((c) => (
                  <th key={c.id} className="px-2 py-3 text-center" title={c.nome}>
                    {c.id}
                    <div className="font-normal normal-case text-slate-400">/{c.pontos}</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center">Total</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {alunos.map((a) => {
                const notasAluno = notas[a.id] ?? {};
                const total = componentes.reduce((s, c) => s + (notasAluno[c.id] ?? 0), 0);
                return (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-900">{a.nome}</td>
                    {componentes.map((c) => (
                      <td key={c.id} className="px-2 py-2 text-center">
                        <input
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-center text-sm outline-none focus:border-accent"
                          inputMode="decimal"
                          value={notasAluno[c.id] ?? ""}
                          onChange={(e) => definirNota(a.id, c.id, e.target.value, c.pontos)}
                          onBlur={() => salvarAluno(a.id)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold">{total.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => emitirBoletim(a.id)} className="text-sm text-primary-600 hover:underline">
                        Boletim
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {boletim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Boletim — {boletim.aluno.nome}</h2>
                <p className="text-xs text-slate-500">{boletim.instituicao} · {boletim.periodo}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  Imprimir
                </button>
                <button onClick={() => setBoletim(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  Fechar
                </button>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Disciplina</th>
                  {(boletim.config.componentes ?? []).map((c) => (
                    <th key={c.id} className="px-2 py-2 text-center">{c.id}</th>
                  ))}
                  <th className="px-2 py-2 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {boletim.linhas.map((l) => (
                  <tr key={l.disciplina} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{l.disciplina}</td>
                    {(boletim.config.componentes ?? []).map((c) => (
                      <td key={c.id} className="px-2 py-2 text-center">{l.componentes[c.id] ?? "—"}</td>
                    ))}
                    <td className="px-2 py-2 text-center font-semibold">{l.total?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
