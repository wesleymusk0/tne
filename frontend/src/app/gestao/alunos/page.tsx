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
  turmaId?: string;
  status?: string;
  [campo: string]: unknown;
}

const NECESSIDADES: { campo: string; rotulo: string }[] = [
  { campo: "cadeirante", rotulo: "Cadeirante" },
  { campo: "oculos", rotulo: "Necessita de óculos" },
  { campo: "defVisual", rotulo: "Deficiência visual" },
  { campo: "defAuditiva", rotulo: "Deficiência auditiva" },
  { campo: "defMotora", rotulo: "Deficiência motora" },
  { campo: "defIntelectual", rotulo: "Deficiência intelectual" },
  { campo: "autismo", rotulo: "Autismo (TEA)" },
  { campo: "tdah", rotulo: "TDAH" },
  { campo: "dislexia", rotulo: "Dislexia" },
  { campo: "discalculia", rotulo: "Discalculia" },
  { campo: "disgrafia", rotulo: "Disgrafia" },
  { campo: "multiplasNecessidades", rotulo: "Múltiplas necessidades" },
  { campo: "pei", rotulo: "PEI" },
  { campo: "adaptacao", rotulo: "Necessita de adaptação" },
];

const FORM_VAZIO = {
  nome: "", genero: "", matricula: "", numeroChamada: "", turno: "", anoLetivo: "",
  cgm: "", rg: "", cpf: "", email: "", turmaId: "", altura: "media", status: "ativo",
  outrasNecessidades: "", respNome: "", respParentesco: "", respTelefone: "",
  respEmail: "", respPreferencia: "whatsapp",
};

export default function AlunosPage() {
  const { perfil, tenantAtivo } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [filtroTurma, setFiltroTurma] = useState("");
  const [form, setForm] = useState(FORM_VAZIO);
  const [necessidades, setNecessidades] = useState<Record<string, boolean>>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const carregar = useCallback(() => {
    if (!tenantAtivo) return;
    api.get<{ turmas: Turma[] }>(`/academico/${tenantAtivo}/turmas`).then((r) => setTurmas(r.turmas)).catch(() => undefined);
    const qs = filtroTurma ? `?turmaId=${filtroTurma}` : "";
    api.get<{ alunos: Aluno[] }>(`/academico/${tenantAtivo}/alunos${qs}`).then((r) => setAlunos(r.alunos)).catch(() => undefined);
  }, [tenantAtivo, filtroTurma]);

  useEffect(carregar, [carregar]);

  function setCampo(campo: string, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOk("");
    try {
      await api.post(`/academico/${tenantAtivo}/alunos`, {
        nome: form.nome,
        genero: form.genero || undefined,
        matricula: form.matricula || undefined,
        numeroChamada: form.numeroChamada ? Number(form.numeroChamada) : undefined,
        turno: form.turno || undefined,
        anoLetivo: form.anoLetivo ? Number(form.anoLetivo) : undefined,
        cgm: form.cgm || undefined,
        rg: form.rg || undefined,
        cpf: form.cpf || undefined,
        email: form.email || undefined,
        turmaId: form.turmaId || undefined,
        altura: form.altura,
        status: form.status,
        outrasNecessidades: form.outrasNecessidades || undefined,
        ...necessidades,
        responsavel: {
          nome: form.respNome || undefined,
          parentesco: form.respParentesco || undefined,
          telefone: form.respTelefone || undefined,
          email: form.respEmail || undefined,
          preferenciaContato: form.respPreferencia,
        },
      });
      setOk(`Aluno(a) ${form.nome} cadastrado(a).`);
      setForm(FORM_VAZIO);
      setNecessidades({});
      carregar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao cadastrar aluno.");
    }
  }

  if (!tenantAtivo) {
    return (
      <AppShell titulo="Alunos" itens={itens}>
        <p className="text-sm text-slate-500">Selecione uma instituição no Dashboard.</p>
      </AppShell>
    );
  }

  const campo =
    "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <AppShell titulo="Gestão de Alunos" itens={itens}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={campo} value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)}>
          <option value="">Todas as turmas</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          {mostrarForm ? "Fechar formulário" : "+ Novo aluno"}
        </button>
        {ok && <span className="text-sm text-green-700">{ok}</span>}
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>

      {mostrarForm && (
        <form onSubmit={cadastrar} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input className={campo} placeholder="Nome completo *" value={form.nome} onChange={(e) => setCampo("nome", e.target.value)} required />
          <select className={campo} value={form.genero} onChange={(e) => setCampo("genero", e.target.value)}>
            <option value="">Gênero</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
            <option value="O">Outro</option>
          </select>
          <input className={campo} placeholder="Matrícula" value={form.matricula} onChange={(e) => setCampo("matricula", e.target.value)} />
          <input className={campo} placeholder="Nº de chamada" inputMode="numeric" value={form.numeroChamada} onChange={(e) => setCampo("numeroChamada", e.target.value)} />
          <select className={campo} value={form.turmaId} onChange={(e) => setCampo("turmaId", e.target.value)}>
            <option value="">Turma</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          <select className={campo} value={form.turno} onChange={(e) => setCampo("turno", e.target.value)}>
            <option value="">Turno</option>
            {["Manhã", "Tarde", "Noite", "Integral"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input className={campo} placeholder="Ano letivo" inputMode="numeric" value={form.anoLetivo} onChange={(e) => setCampo("anoLetivo", e.target.value)} />
          <select className={campo} value={form.altura} onChange={(e) => setCampo("altura", e.target.value)}>
            <option value="baixa">Altura: baixa</option>
            <option value="media">Altura: média</option>
            <option value="alta">Altura: alta</option>
          </select>
          <input className={campo} placeholder="CGM" value={form.cgm} onChange={(e) => setCampo("cgm", e.target.value)} />
          <input className={campo} placeholder="RG" value={form.rg} onChange={(e) => setCampo("rg", e.target.value)} />
          <input className={campo} placeholder="CPF" value={form.cpf} onChange={(e) => setCampo("cpf", e.target.value)} />
          <input className={campo} placeholder="E-mail do aluno" type="email" value={form.email} onChange={(e) => setCampo("email", e.target.value)} />

          <fieldset className="col-span-full grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-3 lg:grid-cols-4">
            <legend className="px-1 text-xs font-medium text-slate-500">Necessidades (usado pelo MapIA)</legend>
            {NECESSIDADES.map((n) => (
              <label key={n.campo} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!necessidades[n.campo]}
                  onChange={(e) => setNecessidades((prev) => ({ ...prev, [n.campo]: e.target.checked }))}
                />
                {n.rotulo}
              </label>
            ))}
            <input
              className={`${campo} col-span-full`}
              placeholder="Outras necessidades (descreva)"
              value={form.outrasNecessidades}
              onChange={(e) => setCampo("outrasNecessidades", e.target.value)}
            />
          </fieldset>

          <fieldset className="col-span-full grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <legend className="px-1 text-xs font-medium text-slate-500">Responsável</legend>
            <input className={campo} placeholder="Nome" value={form.respNome} onChange={(e) => setCampo("respNome", e.target.value)} />
            <input className={campo} placeholder="Parentesco" value={form.respParentesco} onChange={(e) => setCampo("respParentesco", e.target.value)} />
            <input className={campo} placeholder="Telefone (WhatsApp)" value={form.respTelefone} onChange={(e) => setCampo("respTelefone", e.target.value)} />
            <input className={campo} placeholder="E-mail" type="email" value={form.respEmail} onChange={(e) => setCampo("respEmail", e.target.value)} />
            <select className={campo} value={form.respPreferencia} onChange={(e) => setCampo("respPreferencia", e.target.value)}>
              <option value="whatsapp">Prefere WhatsApp</option>
              <option value="email">Prefere e-mail</option>
              <option value="telefone">Prefere ligação</option>
            </select>
          </fieldset>

          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 sm:col-span-2 lg:col-span-1">
            Cadastrar aluno
          </button>
        </form>
      )}

      {alunos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Nenhum aluno encontrado. Crie primeiro a estrutura de turmas e depois cadastre os alunos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">{a.numeroChamada ?? "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{a.nome}</td>
                  <td className="px-4 py-2.5">{turmas.find((t) => t.id === a.turmaId)?.nome ?? "—"}</td>
                  <td className="px-4 py-2.5">{String(a.matricula ?? "—")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "ativo" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {a.status ?? "ativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
