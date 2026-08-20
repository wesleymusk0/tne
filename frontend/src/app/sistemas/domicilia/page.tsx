"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { menuParaSistema } from "@/lib/menu";

interface Turma {
  id: string;
  nome: string;
}

interface Aluno {
  id: string;
  nome: string;
  turmaId?: string;
}

interface Atividade {
  id: string;
  alunoId: string;
  turmaId?: string;
  instrucoes: string;
  fichaInstrucional?: string | null;
  anexos: string[];
  status: string;
  criadoEm: number;
}

interface ConfigDomicilia {
  ficha: "padrao" | "opcional" | "ausente";
  enviarPorEmail: boolean;
  manterNoSistema: boolean;
  permitirImpressao: boolean;
  lembreteIntervaloDias: number;
}

export default function DomiciliaPage() {
  const { tenantAtivo } = useAuth();
  const [config, setConfig] = useState<ConfigDomicilia>({
    ficha: "opcional", enviarPorEmail: false, manterNoSistema: true, permitirImpressao: true, lembreteIntervaloDias: 15,
  });
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [ficha, setFicha] = useState("");
  const [anexos, setAnexos] = useState("");
  const [msg, setMsg] = useState("");

  const menuItens = menuParaSistema("domicilia");

  const carregar = useCallback(() => {
    if (!tenantAtivo) return;
    api.get<{ turmas: Turma[] }>(`/academico/${tenantAtivo}/turmas`).then((r) => setTurmas(r.turmas)).catch(() => undefined);
    api.get<{ atividades: Atividade[]; config: ConfigDomicilia }>(`/domicilia/${tenantAtivo}/atividades`)
      .then((r) => {
        setAtividades(r.atividades);
        if (r.config.ficha) setConfig(r.config);
      })
      .catch(() => undefined);
  }, [tenantAtivo]);

  useEffect(carregar, [carregar]);

  useEffect(() => {
    if (!tenantAtivo || !turmaId) {
      if (!turmaId) setAlunos([]);
      return;
    }
    api.get<{ alunos: Aluno[] }>(`/academico/${tenantAtivo}/alunos?turmaId=${turmaId}`).then((r) => setAlunos(r.alunos)).catch(() => undefined);
  }, [tenantAtivo, turmaId]);

  async function criar() {
    setMsg("");
    try {
      await api.post(`/domicilia/${tenantAtivo}/atividades`, {
        alunoId,
        turmaId: turmaId || undefined,
        instrucoes,
        fichaInstrucional: ficha.trim() ? ficha : undefined,
        anexos: anexos.split("\n").map((a) => a.trim()).filter(Boolean),
      });
      setInstrucoes("");
      setFicha("");
      setAnexos("");
      carregar();
      setMsg("Atividade criada.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao criar atividade.");
    }
  }

  async function salvarConfig() {
    try {
      await api.put(`/domicilia/${tenantAtivo}/config`, config);
      setMsg("Configuração salva.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao salvar config.");
    }
  }

  async function enviar(id: string) {
    try {
      const r = await api.post<{ email: { enviado: boolean; motivo?: string } }>(`/domicilia/${tenantAtivo}/atividades/${id}/enviar`, {});
      setMsg(r.email.enviado ? "Atividade enviada por e-mail ao responsável." : `Marcada como enviada. (${r.email.motivo ?? ""})`);
      carregar();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao enviar.");
    }
  }

  if (!tenantAtivo) {
    return (
      <AppShell titulo="DomicilIA" itens={menuItens}>
        <p className="text-sm text-slate-500">Selecione uma instituição no Dashboard.</p>
      </AppShell>
    );
  }

  return (
    <AppShell titulo="DomicilIA — Atividades Domiciliares" itens={menuItens}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-slate-100 p-4">
            <h2 className="mb-3 font-medium text-slate-900">Nova atividade domiciliar</h2>
            <div className="flex flex-col gap-2">
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                <option value="">Selecione a turma</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
                <option value="">Selecione o aluno</option>
                {alunos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
              <textarea
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Instruções para o aluno/responsável"
                rows={3}
                value={instrucoes}
                onChange={(e) => setInstrucoes(e.target.value)}
              />
              {config.ficha !== "ausente" && (
                <textarea
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder={`Ficha instrucional ${config.ficha === "padrao" ? "(obrigatória)" : "(opcional)"}`}
                  rows={3}
                  value={ficha}
                  onChange={(e) => setFicha(e.target.value)}
                />
              )}
              <textarea
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Anexos/links (um por linha)"
                rows={2}
                value={anexos}
                onChange={(e) => setAnexos(e.target.value)}
              />
              <button onClick={criar} disabled={!alunoId || !instrucoes.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60">
                Criar atividade
              </button>
            </div>
          </div>

          <div className="rounded-md border border-slate-100 p-4">
            <h2 className="mb-3 font-medium text-slate-900">Configuração da instituição</h2>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Ficha instrucional</span>
                <select className="rounded-lg border border-slate-200 px-3 py-2" value={config.ficha} onChange={(e) => setConfig({ ...config, ficha: e.target.value as ConfigDomicilia["ficha"] })}>
                  <option value="padrao">Obrigatória (padrão)</option>
                  <option value="opcional">Opcional</option>
                  <option value="ausente">Sem ficha</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.enviarPorEmail} onChange={(e) => setConfig({ ...config, enviarPorEmail: e.target.checked })} />
                Enviar por e-mail ao responsável
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.manterNoSistema} onChange={(e) => setConfig({ ...config, manterNoSistema: e.target.checked })} />
                Manter disponível no sistema
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.permitirImpressao} onChange={(e) => setConfig({ ...config, permitirImpressao: e.target.checked })} />
                Permitir impressão
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Lembrete de pendências a cada (dias)</span>
                <input
                  className="w-32 rounded-lg border border-slate-200 px-3 py-2"
                  inputMode="numeric"
                  value={config.lembreteIntervaloDias}
                  onChange={(e) => setConfig({ ...config, lembreteIntervaloDias: Math.max(1, Number(e.target.value) || 15) })}
                />
              </label>
              <button onClick={salvarConfig} className="w-fit rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Salvar configuração
              </button>
            </div>
          </div>
        </div>

        <div>
          {msg && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{msg}</p>}
          <h2 className="mb-3 font-medium text-slate-900">Atividades ({atividades.length})</h2>
          {atividades.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">Nenhuma atividade cadastrada.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {atividades.map((a) => (
                <li key={a.id} className="rounded-md border border-slate-100 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{alunos.find((x) => x.id === a.alunoId)?.nome ?? a.alunoId}</div>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{a.instrucoes}</p>
                      {a.fichaInstrucional && <p className="mt-1 rounded bg-slate-50 p-2 text-xs">{a.fichaInstrucional}</p>}
                      {a.anexos.length > 0 && (
                        <ul className="mt-1 text-xs text-primary-600">
                          {a.anexos.map((anx, i) => (
                            <li key={i}>
                              <a href={anx} target="_blank" rel="noreferrer" className="hover:underline">{anx}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "pendente" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                        {a.status}
                      </span>
                      {a.status === "pendente" && (
                        <button onClick={() => enviar(a.id)} className="text-xs text-primary-600 hover:underline">
                          Enviar
                        </button>
                      )}
                      {config.permitirImpressao && (
                        <button onClick={() => window.print()} className="text-xs text-slate-500 hover:underline">
                          Imprimir
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Criada em {new Date(a.criadoEm).toLocaleDateString("pt-BR")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
