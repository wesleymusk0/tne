"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell, ConfirmarAcao } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMenuItens } from "@/lib/menu";

interface Turma {
  id: string;
  nome: string;
  anoLetivo?: number;
  turno?: string;
}

export default function TurmasPage() {
  const { perfil, tenantAtivo } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [nome, setNome] = useState("");
  const [anoLetivo, setAnoLetivo] = useState("");
  const [turno, setTurno] = useState("Manhã");
  const [erro, setErro] = useState("");
  const [excluir, setExcluir] = useState<Turma | null>(null);

  const carregar = useCallback(() => {
    if (!tenantAtivo) return;
    api.get<{ turmas: Turma[] }>(`/academico/${tenantAtivo}/turmas`).then((r) => setTurmas(r.turmas)).catch(() => setTurmas([]));
  }, [tenantAtivo]);

  useEffect(carregar, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await api.post(`/academico/${tenantAtivo}/turmas`, {
        nome,
        anoLetivo: anoLetivo ? Number(anoLetivo) : undefined,
        turno,
      });
      setNome("");
      setAnoLetivo("");
      carregar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao criar turma.");
    }
  }

  if (!tenantAtivo) {
    return (
      <AppShell titulo="Turmas" itens={itens}>
        <p className="text-sm text-slate-500">Selecione uma instituição no Dashboard para gerenciar turmas.</p>
      </AppShell>
    );
  }

  return (
    <AppShell titulo="Turmas" itens={itens}>
      <form onSubmit={criar} className="mb-6 flex flex-wrap items-end gap-3 rounded-md border border-slate-100 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Nome da turma</label>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: 6º Ano A" required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Ano letivo</label>
          <input
            className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            value={anoLetivo} onChange={(e) => setAnoLetivo(e.target.value)} placeholder="2026" inputMode="numeric"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Turno</label>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            value={turno} onChange={(e) => setTurno(e.target.value)}
          >
            {["Manhã", "Tarde", "Noite", "Integral"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
          Criar turma
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </form>

      {turmas.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Nenhuma turma cadastrada. Crie a estrutura de turmas antes de cadastrar alunos.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-md border border-slate-100 p-4 shadow-sm">
              <div>
                <div className="font-medium text-slate-900">{t.nome}</div>
                <div className="text-xs text-slate-500">
                  {t.turno ?? "—"}{t.anoLetivo ? ` · ${t.anoLetivo}` : ""}
                </div>
              </div>
              <button onClick={() => setExcluir(t)} className="text-sm text-red-600 hover:underline">
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmarAcao
        aberto={!!excluir}
        mensagem={`Excluir a turma "${excluir?.nome}"? Alunos vinculados impedem a exclusão.`}
        onCancelar={() => setExcluir(null)}
        onConfirmar={async () => {
          if (!excluir) return;
          try {
            await api.delete(`/academico/${tenantAtivo}/turmas/${excluir.id}`);
            carregar();
          } catch (err) {
            setErro(err instanceof ApiError ? err.message : "Erro ao excluir.");
          }
          setExcluir(null);
        }}
      />
    </AppShell>
  );
}
