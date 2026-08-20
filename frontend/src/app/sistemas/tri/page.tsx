"use client";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { menuParaSistema } from "@/lib/menu";

interface ItemTRI {
  index: number;
  a: number | "";
  b: number | "";
  c: number;
}

interface AlunoTRI {
  studentId: string;
  responses: (number | null)[];
}

interface ResultadoTRI {
  items_calibrados: ItemTRI[];
  scores: Record<string, { theta: number | null; saebScore: number | null }>;
  avgSaeb: number | null;
}

function parseCsv(texto: string): { itens: ItemTRI[]; alunos: AlunoTRI[] } | { erro: string } {
  const linhas = texto.trim().split(/\r?\n/).filter(Boolean);
  if (linhas.length < 2) return { erro: "CSV precisa de cabeçalho e ao menos um aluno." };
  const header = linhas[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
  const idxAluno = header.findIndex((h) => ["aluno", "studentid", "nome"].includes(h));
  if (idxAluno < 0) return { erro: "Cabeçalho deve conter coluna 'aluno'." };
  const nItens = header.length - 1;
  const itens: ItemTRI[] = Array.from({ length: nItens }, (_, i) => ({ index: i, a: "", b: "", c: 0.2 }));
  const alunos: AlunoTRI[] = [];
  for (const linha of linhas.slice(1)) {
    const col = linha.split(/[;,]/).map((c) => c.trim());
    alunos.push({
      studentId: col[idxAluno] || `aluno${alunos.length + 1}`,
      responses: Array.from({ length: nItens }, (_, i) => {
        const v = col[i + (idxAluno === 0 ? 1 : 0)] ?? "";
        if (["1", "0"].includes(v)) return Number(v);
        return null;
      }),
    });
    // colunas de aluno podem estar no meio; normalizar
    alunos[alunos.length - 1].responses = col
      .filter((_, i) => i !== idxAluno)
      .map((v) => (["1", "0"].includes(v) ? Number(v) : null));
  }
  return { itens, alunos };
}

export default function TriPage() {
  const { tenantAtivo } = useAuth();
  const [csv, setCsv] = useState("");
  const [itens, setItens] = useState<ItemTRI[]>([]);
  const [alunos, setAlunos] = useState<AlunoTRI[]>([]);
  const [resultado, setResultado] = useState<ResultadoTRI | null>(null);
  const [msg, setMsg] = useState("");
  const [gerando, setGerando] = useState(false);

  const menuItens = menuParaSistema("tri");

  function carregarCsv() {
    const r = parseCsv(csv);
    if ("erro" in r) {
      setMsg(r.erro);
      return;
    }
    setItens(r.itens);
    setAlunos(r.alunos);
    setMsg(`${r.alunos.length} alunos, ${r.itens.length} itens carregados.`);
  }

  async function analisar() {
    if (alunos.length === 0) {
      setMsg("Carregue um CSV primeiro.");
      return;
    }
    setGerando(true);
    setMsg("");
    try {
      const proj = await api.post<{ projetoId: string }>("/projetos/tri", {
        tenantId: tenantAtivo ?? undefined,
        nome: `Simulação ${new Date().toLocaleDateString("pt-BR")}`,
      });
      const r = await api.post<ResultadoTRI>("/engines/tri/analise", {
        tenantId: tenantAtivo ?? undefined,
        projetoId: proj.projetoId,
        items: itens,
        students: alunos,
      });
      setResultado(r);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro na análise.");
    } finally {
      setGerando(false);
    }
  }

  const scoresOrdenados = useMemo(
    () => (resultado ? Object.entries(resultado.scores).sort((a, b) => (b[1].saebScore ?? 0) - (a[1].saebScore ?? 0)) : []),
    [resultado]
  );
  const maxSaeb = useMemo(() => Math.max(500, ...scoresOrdenados.map(([, s]) => s.saebScore ?? 0)), [scoresOrdenados]);

  return (
    <AppShell titulo="Simulador TRI" itens={menuItens}>
      <div className="max-w-4xl">
        <p className="mb-3 text-sm text-slate-600">
          Cole um CSV com a coluna <code>aluno</code> e uma coluna por item (1 = acertou, 0 = errou, vazio = inválido).
        </p>
        <textarea
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          rows={6}
          placeholder={"aluno;q1;q2;q3\nAna;1;0;1\nBruno;0;1;1"}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={carregarCsv} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Carregar CSV
          </button>
          <button onClick={analisar} disabled={gerando} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60">
            {gerando ? "Analisando..." : "Analisar (TRI 3PL)"}
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}

        {itens.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">a (discriminação)</th>
                  <th className="px-3 py-2">b (dificuldade)</th>
                  <th className="px-3 py-2">c (acerto casual)</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">Q{i + 1}</td>
                    {(["a", "b", "c"] as const).map((p) => (
                      <td key={p} className="px-3 py-1.5">
                        <input
                          className="w-20 rounded border border-slate-200 px-2 py-0.5 text-center"
                          value={it[p]}
                          onChange={(e) =>
                            setItens(itens.map((x, j) => (j === i ? { ...x, [p]: e.target.value === "" ? "" : Number(e.target.value) } : x)))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-slate-500">Itens com a/b vazios são calibrados heuristicamente.</p>
          </div>
        )}

        {resultado && (
          <div className="mt-6 rounded-md border border-slate-100 p-4">
            <div className="mb-3 text-lg font-semibold text-slate-900">
              Média SAEB: {resultado.avgSaeb ?? "—"} (0–500)
            </div>
            <div className="flex flex-col gap-1.5">
              {scoresOrdenados.map(([aluno, s]) => (
                <div key={aluno} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate font-medium text-slate-700">{aluno}</span>
                  <div className="h-5 flex-1 rounded bg-slate-100">
                    <div
                      className="h-5 rounded bg-accent text-right text-[10px] font-medium leading-5 text-white"
                      style={{ width: `${((s.saebScore ?? 0) / maxSaeb) * 100}%` }}
                    >
                      {s.saebScore?.toFixed(1) ?? "—"}
                    </div>
                  </div>
                  <span className="w-20 text-xs text-slate-500">θ {s.theta?.toFixed(2) ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
