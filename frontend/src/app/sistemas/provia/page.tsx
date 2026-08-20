"use client";

import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Questao {
  enunciado: string;
  alternativas: string[];
  correta: number;
}

const FORM_VAZIO = { instituicao: "", materia: "", professor: "", periodo: "" };

export default function ProviaPage() {
  const { perfil, tenantAtivo } = useAuth();
  const [meta, setMeta] = useState(FORM_VAZIO);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [msg, setMsg] = useState("");
  const [modo, setModo] = useState<"editar" | "imprimir">("editar");

  const menuItens = [
    { href: "/dashboard", rotulo: "Dashboard", icone: "🏠" },
    { href: "/sistemas/provia", rotulo: "ProvIA", icone: "📄" },
  ];

  const limiteFree = perfil?.plano.tipo === "free" && !tenantAtivo ? 4 : null;

  async function salvarProjeto() {
    try {
      await api.post("/projetos/provia", {
        tenantId: tenantAtivo ?? undefined,
        nome: meta.materia || "Prova",
        dados: { meta, questoes },
      });
      setMsg("Projeto de Prova salvo.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao salvar.");
    }
  }

  function adicionarQuestao() {
    if (limiteFree && questoes.length >= limiteFree) {
      setMsg("Limite do plano FREE: máximo de 4 questões por prova. Faça upgrade.");
      return;
    }
    setQuestoes((q) => [...q, { enunciado: "", alternativas: ["", "", "", ""], correta: 0 }]);
  }

  return (
    <AppShell titulo="ProvIA — Montagem de Provas" itens={menuItens}>
      <div className="max-w-4xl">
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-4">
          {(
            [
              ["instituicao", "Instituição"],
              ["materia", "Matéria"],
              ["professor", "Professor(a)"],
              ["periodo", "Período"],
            ] as [keyof typeof FORM_VAZIO, string][]
          ).map(([campo, rotulo]) => (
            <div key={campo} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">{rotulo}</label>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                value={meta[campo]}
                onChange={(e) => setMeta({ ...meta, [campo]: e.target.value })}
              />
            </div>
          ))}
        </div>

        {modo === "editar" ? (
          <>
            <div className="flex flex-col gap-4">
              {questoes.map((q, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">Questão {i + 1}</h3>
                    <button onClick={() => setQuestoes(questoes.filter((_, j) => j !== i))} className="text-red-600">✕</button>
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="Enunciado da questão"
                    value={q.enunciado}
                    onChange={(e) => setQuestoes(questoes.map((x, j) => (j === i ? { ...x, enunciado: e.target.value } : x)))}
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {q.alternativas.map((alt, ai) => (
                      <div key={ai} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correta-${i}`}
                          checked={q.correta === ai}
                          onChange={() => setQuestoes(questoes.map((x, j) => (j === i ? { ...x, correta: ai } : x)))}
                        />
                        <input
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-accent"
                          placeholder={`Alternativa ${String.fromCharCode(65 + ai)}`}
                          value={alt}
                          onChange={(e) =>
                            setQuestoes(
                              questoes.map((x, j) =>
                                j === i ? { ...x, alternativas: x.alternativas.map((a, k) => (k === ai ? e.target.value : a)) } : x
                              )
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={adicionarQuestao} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                + Adicionar questão {limiteFree ? `(${questoes.length}/4)` : ""}
              </button>
              <button onClick={() => setModo("imprimir")} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
                Visualizar impressão
              </button>
              <button onClick={salvarProjeto} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Salvar projeto
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-100 bg-white p-8 shadow-sm" id="prova-print">
            <div className="text-center">
              <h2 className="font-bold text-slate-900">{meta.instituicao || "Instituição"}</h2>
              <p className="text-sm text-slate-600">
                {meta.materia} — {meta.periodo}
              </p>
              <p className="text-sm text-slate-600">Professor(a): {meta.professor}</p>
              <p className="mt-2 text-left text-sm font-medium">Nome: ______________________________ Turma: _______</p>
            </div>
            <ol className="mt-6 flex flex-col gap-5">
              {questoes.map((q, i) => (
                <li key={i}>
                  <p className="text-sm font-medium">{i + 1}. {q.enunciado}</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                    {q.alternativas.map((alt, ai) => (
                      <li key={ai}>
                        ({String.fromCharCode(97 + ai)}) {alt}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex gap-2">
              <button onClick={() => window.print()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Imprimir</button>
              <button onClick={() => setModo("editar")} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Voltar</button>
            </div>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </AppShell>
  );
}
