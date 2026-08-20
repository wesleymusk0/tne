"use client";

import { useCallback, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { menuParaSistema } from "@/lib/menu";

interface Restricao {
  type: "must" | "cannot" | "prefer";
  targetId: string;
}

interface Aluno {
  id: string;
  matricula: string;
  name: string;
  originalClass: string;
  gender: "M" | "F" | "O";
  score: number;
  constraints: Restricao[];
}

interface ResultadoEnturmacao {
  classes: Record<string, { id: string; matricula: string; name: string }[]>;
  profile: Record<string, { balanceScores: string; genderCounts: Record<string, number> }>;
  fixos?: { id: string; name: string; matricula: string }[];
}

const FORM_VAZIO: Aluno = {
  id: "", matricula: "", name: "", originalClass: "", gender: "M", score: 3, constraints: [],
};

export default function RemanejiaPage() {
  const { tenantAtivo } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [form, setForm] = useState<Aluno>(FORM_VAZIO);
  const [numClasses, setNumClasses] = useState(3);
  const [mix, setMix] = useState(100);
  const [prioridades, setPrioridades] = useState({ pMand: true, pPref: true, pBal: true });
  const [resultado, setResultado] = useState<ResultadoEnturmacao | null>(null);
  const [msg, setMsg] = useState("");
  const [gerando, setGerando] = useState(false);
  const [modoLink, setModoLink] = useState(false);

  const menuItens = menuParaSistema("remanejia");

  function adicionar() {
    if (!form.name.trim()) return;
    const id = form.id || `s${Date.now()}`;
    setAlunos((prev) => [...prev, { ...form, id }]);
    setForm(FORM_VAZIO);
  }

  const gerar = useCallback(async () => {
    if (alunos.length === 0) {
      setMsg("Adicione alunos antes de gerar.");
      return;
    }
    setGerando(true);
    setMsg("");
    try {
      const proj = await api.post<{ projetoId: string }>("/projetos/remanejia", {
        tenantId: tenantAtivo ?? undefined,
        nome: `Enturmação ${new Date().toLocaleDateString("pt-BR")}`,
      });
      const r = await api.post<ResultadoEnturmacao>("/engines/remanejia/gerar", {
        tenantId: tenantAtivo ?? undefined,
        projetoId: proj.projetoId,
        students: alunos,
        numClasses,
        mixPercentage: mix,
        priorities: prioridades,
      });
      setResultado(r);
      setMsg("Enturmação gerada dentro de um único Projeto de Remanejamento.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao gerar enturmação.");
    } finally {
      setGerando(false);
    }
  }, [alunos, numClasses, mix, prioridades, tenantAtivo]);

  return (
    <AppShell titulo="RemanejIA — Enturmação Inteligente" itens={menuItens}>
      <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
        <section className="flex flex-col gap-3">
          <div className="rounded-md border border-slate-100 p-3">
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" placeholder="Matrícula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" placeholder="Turma original" value={form.originalClass} onChange={(e) => setForm({ ...form, originalClass: e.target.value })} />
              <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Aluno["gender"] })}>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="O">Outro</option>
              </select>
              <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={form.score} onChange={(e) => setForm({ ...form, score: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>Nota {s}</option>
                ))}
              </select>
              <button onClick={adicionar} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white">Adicionar</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Restrições no card do aluno: juntos (must), separados (cannot) ou preferência (prefer).</p>
          </div>

          <ul className="max-h-[40vh] flex flex-col gap-1.5 overflow-auto text-sm">
            {alunos.map((a, i) => (
              <li key={a.id} className="rounded-lg border border-slate-100 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.name} <span className="text-xs text-slate-400">({a.originalClass} · {a.gender} · nota {a.score})</span></span>
                  <button onClick={() => setAlunos(alunos.filter((x) => x.id !== a.id))} className="text-xs text-red-600">✕</button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(["must", "cannot", "prefer"] as const).map((t) => (
                    <select
                      key={t}
                      className={`rounded px-1.5 py-0.5 text-xs ${t === "must" ? "bg-green-50 text-green-700" : t === "cannot" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setAlunos(
                          alunos.map((x) =>
                            x.id === a.id
                              ? { ...x, constraints: [...x.constraints, { type: t, targetId: e.target.value }] }
                              : x
                          )
                        );
                      }}
                    >
                      <option value="">+ {t === "must" ? "juntx" : t === "cannot" ? "separadx" : "preferix"}</option>
                      {alunos.filter((x) => x.id !== a.id).map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                  ))}
                  {a.constraints.map((c, k) => (
                    <span key={k} className={`rounded px-1.5 py-0.5 text-xs ${c.type === "must" ? "bg-green-100 text-green-800" : c.type === "cannot" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
                      {c.type === "must" ? "juntx" : c.type === "cannot" ? "separadx" : "preferix"}: {alunos.find((x) => x.id === c.targetId)?.name}
                      <button
                        onClick={() =>
                          setAlunos(
                            alunos.map((x) =>
                              x.id === a.id ? { ...x, constraints: x.constraints.filter((_, j) => j !== k) } : x
                            )
                          )
                        }
                        className="ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-md border border-slate-100 p-3 text-sm">
            <label className="text-xs font-medium text-slate-500">Número de turmas</label>
            <div className="mt-1 flex items-center gap-3">
              <input type="range" min={2} max={8} value={numClasses} onChange={(e) => setNumClasses(Number(e.target.value))} className="flex-1" />
              <span className="font-semibold">{numClasses}</span>
            </div>
            <label className="mt-2 text-xs font-medium text-slate-500">Percentual de mistura</label>
            <div className="mt-1 flex items-center gap-3">
              <input type="range" min={0} max={100} value={mix} onChange={(e) => setMix(Number(e.target.value))} className="flex-1" />
              <span className="font-semibold">{mix}%</span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {(
                [
                  ["pMand", "Restrições obrigatórias (junto/separado)"],
                  ["pPref", "Preferências"],
                  ["pBal", "Balancear notas e gêneros"],
                ] as const
              ).map(([k, rotulo]) => (
                <label key={k} className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={prioridades[k]}
                    onChange={(e) => setPrioridades({ ...prioridades, [k]: e.target.checked })}
                  />
                  {rotulo}
                </label>
              ))}
            </div>
            {modoLink && (
              <p className="mt-2 rounded bg-slate-50 p-2 text-xs">
                Modo link (quiosque): {window.location.origin}/sistemas/remanejia?link=1
              </p>
            )}
            <button onClick={() => setModoLink((v) => !v)} className="mt-1 text-xs text-slate-400 hover:underline">
              {modoLink ? "Ocultar link" : "Gerar link para quiosque"}
            </button>
          </div>

          <button onClick={gerar} disabled={gerando} className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60">
            {gerando ? "Gerando..." : "Gerar enturmação"}
          </button>
          {msg && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{msg}</p>}
        </section>

        <section>
          {resultado ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(resultado.classes).map(([turma, alunosT]) => (
                <div key={turma} className="rounded-md border border-slate-100 p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold text-slate-900">Turma {turma}</h3>
                    <span className="text-xs text-slate-400">{alunosT.length} alunos</span>
                  </div>
                  {resultado.profile?.[turma] && (
                    <p className="text-xs text-slate-500">
                      Notas {resultado.profile[turma].balanceScores} ·{" "}
                      {Object.entries(resultado.profile[turma].genderCounts).map(([g, n]) => `${g}: ${n}`).join(" / ")}
                    </p>
                  )}
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {alunosT.map((a) => (
                      <li key={a.id} className="rounded bg-slate-50 px-2 py-1">{a.name} <span className="text-xs text-slate-400">({a.matricula})</span></li>
                    ))}
                  </ul>
                </div>
              ))}
              {resultado.fixos && resultado.fixos.length > 0 && (
                <div className="col-span-full rounded-md border border-amber-100 bg-amber-50 p-4 text-sm">
                  <strong>Mantidos nas turmas originais (mistura {mix}%):</strong>{" "}
                  {resultado.fixos.map((f) => f.name).join(", ")}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
              Configure os alunos, restrições e prioridades à esquerda e gere a enturmação. O percentual de mistura controla quanto as turmas serão embaralhadas (100% = embaralhamento total; 0% = preserva turmas originais).
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
