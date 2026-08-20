"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Turma {
  id: string;
  nome: string;
}

interface AlunoBusca {
  alunoId: string;
  nome: string;
  numeroChamada?: number;
  responsavel?: string;
  telefoneResponsavel?: string;
  preferenciaContato?: string;
}

interface MensagemMontada {
  alunoId: string;
  tipo: "falta" | "atraso";
  conteudo: string;
  telefone: string;
}

const MODELOS = {
  falta: "Olá, [RESPONSÁVEL]. A equipe do [INSTITUIÇÃO] vem informar sobre a ausência de [ALUNO] no dia [DATA].",
  atraso: "Olá, [RESPONSÁVEL]. A equipe do [INSTITUIÇÃO] vem informar que [ALUNO] chegou atrasado à escola no dia [DATA], com aproximadamente [TEMPO] de atraso.",
};

export default function BusciaPage() {
  const { tenantAtivo } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [tipo, setTipo] = useState<"falta" | "atraso">("falta");
  const [numeros, setNumeros] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [alunos, setAlunos] = useState<AlunoBusca[]>([]);
  const [mensagens, setMensagens] = useState<MensagemMontada[]>([]);
  const [instituicao, setInstituicao] = useState("");
  const [msg, setMsg] = useState("");

  const menuItens = [
    { href: "/dashboard", rotulo: "Dashboard", icone: "🏠" },
    { href: "/sistemas/buscia", rotulo: "BuscIA", icone: "📞" },
  ];

  useEffect(() => {
    if (!tenantAtivo) return;
    api.get<{ turmas: Turma[] }>(`/academico/${tenantAtivo}/turmas`).then((r) => {
      setTurmas(r.turmas);
      setTurmaId((atual) => atual || r.turmas[0]?.id || "");
    }).catch(() => undefined);
  }, [tenantAtivo]);

  const buscar = useCallback(async () => {
    if (!tenantAtivo || !turmaId) return;
    setMsg("");
    try {
      const qs = numeros.trim() ? `&numeros=${encodeURIComponent(numeros)}` : "";
      const r = await api.get<{ alunos: AlunoBusca[]; instituicao: string }>(
        `/buscia/${tenantAtivo}/alunos-busca?turmaId=${turmaId}${qs}`
      );
      setAlunos(r.alunos);
      setInstituicao(r.instituicao ?? "");
      montarMensagens(r.alunos, r.instituicao ?? "", tipo, data);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao buscar alunos.");
    }
  }, [tenantAtivo, turmaId, numeros, tipo, data]);

  function montarMensagens(lista: AlunoBusca[], inst: string, tipoMsg: "falta" | "atraso", dt: string) {
    const dataFormatada = new Date(dt + "T12:00:00").toLocaleDateString("pt-BR");
    const montadas = lista.map((a) => {
      let conteudo = MODELOS[tipoMsg];
      conteudo = conteudo.replaceAll("[RESPONSÁVEL]", a.responsavel ?? "responsável");
      conteudo = conteudo.replaceAll("[INSTITUIÇÃO]", inst || "escola");
      conteudo = conteudo.replaceAll("[ALUNO]", a.nome ?? "");
      conteudo = conteudo.replaceAll("[DATA]", dataFormatada);
      conteudo = conteudo.replaceAll("[TEMPO]", "");
      return { alunoId: a.alunoId, tipo: tipoMsg, conteudo, telefone: a.telefoneResponsavel ?? "" } as MensagemMontada;
    });
    setMensagens(montadas);
  }

  useEffect(() => {
    if (alunos.length > 0) montarMensagens(alunos, instituicao, tipo, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, data]);

  function enviarParaExtensao() {
    if (mensagens.length === 0) return;
    // A extensão BuscIA escuta este evento e usa a aba já aberta do WhatsApp Web.
    window.dispatchEvent(new CustomEvent("buscia:mensagens", { detail: { mensagens } }));
    setMsg("Mensagens enviadas para a extensão BuscIA. Se o WhatsApp Web não estiver autenticado, a extensão avisará.");
    registrar(mensagens);
  }

  async function registrar(lista: MensagemMontada[]) {
    try {
      await api.post(`/buscia/${tenantAtivo}/mensagens`, { mensagens: lista });
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao registrar envio.");
    }
  }

  if (!tenantAtivo) {
    return (
      <AppShell titulo="BuscIA — Busca Ativa" itens={menuItens}>
        <p className="text-sm text-slate-500">Selecione uma instituição no Dashboard para usar o BuscIA.</p>
      </AppShell>
    );
  }

  return (
    <AppShell titulo="BuscIA — Busca Ativa" itens={menuItens}>
      <div className="max-w-3xl">
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Turma</label>
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Números de chamada (opcional)</label>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="ex.: 3, 7, 12"
              value={numeros}
              onChange={(e) => setNumeros(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Data</label>
            <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tipo de busca</label>
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as "falta" | "atraso")}>
              <option value="falta">Busca de faltas</option>
              <option value="atraso">Busca de atrasos</option>
            </select>
          </div>
        </div>
        <div className="mb-4 flex gap-2">
          <button onClick={buscar} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
            Montar mensagens
          </button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>

        {mensagens.length > 0 && (
          <>
            <ul className="flex flex-col gap-2">
              {mensagens.map((m, i) => (
                <li key={i} className="rounded-xl border border-slate-100 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{alunos.find((a) => a.alunoId === m.alunoId)?.nome}</span>
                    <span className="text-xs text-slate-400">{m.telefone || "sem telefone"}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">{m.conteudo}</p>
                </li>
              ))}
            </ul>
            <button onClick={enviarParaExtensao} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Enviar via extensão BuscIA (WhatsApp)
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Campos dinâmicos disponíveis no modelo: [RESPONSÁVEL], [INSTITUIÇÃO], [ALUNO], [DATA] e [TEMPO] (para atrasos).
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
