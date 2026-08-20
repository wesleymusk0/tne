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

type Estado = "C" | "F" | "A";

const ESTADOS: { id: Estado; rotulo: string; cor: string; corAtiva: string }[] = [
  { id: "C", rotulo: "C", cor: "text-green-700 border-green-200", corAtiva: "bg-green-100 border-green-400 text-green-800" },
  { id: "F", rotulo: "F", cor: "text-red-700 border-red-200", corAtiva: "bg-red-100 border-red-400 text-red-800" },
  { id: "A", rotulo: "A", cor: "text-amber-700 border-amber-200", corAtiva: "bg-amber-100 border-amber-400 text-amber-800" },
];

export default function PresencaPage() {
  const { perfil, tenantAtivo } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const hoje = new Date().toISOString().slice(0, 10);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [data, setData] = useState(hoje);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [registros, setRegistros] = useState<Record<string, { estado: Estado; atrasoMinutos?: number }>>({});
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!tenantAtivo) return;
    api.get<{ turmas: Turma[] }>(`/academico/${tenantAtivo}/turmas`).then((r) => {
      setTurmas(r.turmas);
      setTurmaId((atual) => atual || r.turmas[0]?.id || "");
    }).catch(() => undefined);
  }, [tenantAtivo]);

  const carregarChamada = useCallback(() => {
    if (!tenantAtivo || !turmaId) return;
    api.get<{ alunos: Aluno[] }>(`/academico/${tenantAtivo}/alunos?turmaId=${turmaId}`).then(async (r) => {
      setAlunos(r.alunos);
      const existentes = await api
        .get<{ presenca: Record<string, { estado: Estado; atrasoMinutos?: number }> }>(
          `/academico/${tenantAtivo}/presenca?data=${data}&turmaId=${turmaId}`
        )
        .catch(() => ({ presenca: {} as Record<string, { estado: Estado; atrasoMinutos?: number }> }));
      const inicial: Record<string, { estado: Estado; atrasoMinutos?: number }> = {};
      for (const a of r.alunos) inicial[a.id] = existentes.presenca[a.id] ?? { estado: "C" };
      setRegistros(inicial);
    }).catch(() => setAlunos([]));
  }, [tenantAtivo, turmaId, data]);

  useEffect(carregarChamada, [carregarChamada]);

  function definir(alunoId: string, estado: Estado) {
    setRegistros((prev) => {
      const atual = { ...prev[alunoId], estado };
      if (estado === "A") {
        const minutos = window.prompt("Tempo aproximado de atraso (minutos):", "10");
        atual.atrasoMinutos = minutos ? Math.max(0, parseInt(minutos, 10) || 0) : undefined;
      } else {
        delete atual.atrasoMinutos;
      }
      return { ...prev, [alunoId]: atual };
    });
  }

  async function salvar() {
    if (!tenantAtivo || !turmaId) return;
    setSalvando(true);
    setMsg("");
    try {
      const r = await api.put<{ registrados: number }>(
        `/academico/${tenantAtivo}/presenca/${data}/${turmaId}`,
        { registros }
      );
      setMsg(`Chamada salva: ${r.registrados} alunos registrados.`);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao salvar chamada.");
    } finally {
      setSalvando(false);
    }
  }

  if (!tenantAtivo) {
    return (
      <AppShell titulo="Presença" itens={itens}>
        <p className="text-sm text-slate-500">Selecione uma instituição no Dashboard.</p>
      </AppShell>
    );
  }

  return (
    <AppShell titulo="Presença" itens={itens}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={turmaId}
          onChange={(e) => setTurmaId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        <button
          onClick={() => setRegistros((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, { estado: "C" as Estado }])))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Marcar todos presentes
        </button>
      </div>

      {alunos.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Nenhum aluno nesta turma.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alunos.map((a) => {
            const reg = registros[a.id] ?? { estado: "C" as Estado };
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 p-3">
                <div className="text-sm">
                  <span className="mr-2 text-slate-400">{a.numeroChamada ?? "—"}</span>
                  <span className="font-medium text-slate-900">{a.nome}</span>
                  {reg.estado === "A" && reg.atrasoMinutos !== undefined && (
                    <span className="ml-2 text-xs text-amber-700">≈ {reg.atrasoMinutos} min de atraso</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {ESTADOS.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => definir(a.id, e.id)}
                      className={`h-9 w-9 rounded-lg border text-sm font-semibold transition-colors ${
                        reg.estado === e.id ? e.corAtiva : `${e.cor} hover:bg-slate-50`
                      }`}
                      title={e.id === "C" ? "Compareceu" : e.id === "F" ? "Faltou" : "Atrasou"}
                    >
                      {e.rotulo}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {alunos.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar chamada"}
          </button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      )}
    </AppShell>
  );
}
