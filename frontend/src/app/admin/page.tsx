"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell, ConfirmarAcao } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMenuItens } from "@/lib/menu";

const SISTEMAS = ["mapia", "horia", "somatoria", "remanejia", "buscia", "domicilia", "notas", "presenca", "avalia", "provia", "tri"];

interface Instituicao {
  id: string;
  nome: string;
  status?: string;
  sistemas: string[];
  totais?: { turmas: number; alunos: number; usuarios: number };
}

interface Log {
  usuario: string;
  acao: string;
  timestamp: number;
  instituicao?: string;
  resultado: string;
}

export default function AdminGlobalPage() {
  const { perfil, tenantAtivo } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const [insts, setInsts] = useState<Instituicao[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [aba, setAba] = useState<"instituicoes" | "stats" | "audit">("instituicoes");
  const [erro, setErro] = useState("");
  const [acao, setAcao] = useState<{ rotulo: string; executar: () => Promise<void> } | null>(null);

  // criar instituição
  const [nome, setNome] = useState("");
  const [sistemas, setSistemas] = useState<string[]>([]);

  const carregar = useCallback(() => {
    api.get<{ instituicoes: Instituicao[] }>("/admin-global/instituicoes").then((r) => setInsts(r.instituicoes)).catch((e) => setErro(e instanceof ApiError ? e.message : ""));
    api.get<{ estatisticas: Record<string, unknown> }>("/admin-global/estatisticas").then((r) => setStats(r.estatisticas)).catch(() => undefined);
    api.get<{ logs: Log[] }>("/admin-global/audit").then((r) => setLogs(r.logs)).catch(() => undefined);
  }, []);

  useEffect(carregar, [carregar]);

  function pedirConfirmacao(rotulo: string, executar: () => Promise<void>) {
    setAcao({ rotulo, executar });
  }

  async function confirmar() {
    if (!acao) return;
    try {
      await acao.executar();
      setErro("");
      carregar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro na ação administrativa.");
    }
    setAcao(null);
  }

  if (!perfil?.adminGlobal) {
    return (
      <AppShell titulo="Administração Global" itens={itens}>
        <p className="text-sm text-slate-500">Acesso restrito ao administrador global.</p>
      </AppShell>
    );
  }

  return (
    <AppShell titulo="Administração Global" itens={itens}>
      <div className="mb-5 flex gap-1 border-b border-slate-100">
        {(["instituicoes", "stats", "audit"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium ${aba === a ? "bg-blue-100 text-blue-800" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {a === "instituicoes" ? "Instituições" : a === "stats" ? "Estatísticas" : "Auditoria"}
          </button>
        ))}
      </div>
      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      {aba === "instituicoes" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pedirConfirmacao("Criar instituição", async () => {
                await api.post("/admin-global/instituicoes", { nome, sistemas, confirmacao: true });
                setNome("");
                setSistemas([]);
              });
            }}
            className="flex flex-col gap-3 rounded-md border border-slate-100 p-4"
          >
            <h2 className="font-medium text-slate-900">Nova instituição</h2>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required
            />
            <div className="grid grid-cols-2 gap-1 text-sm text-slate-600">
              {SISTEMAS.map((s) => (
                <label key={s} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={sistemas.includes(s)}
                    onChange={(e) =>
                      setSistemas((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Criar (com confirmação)
            </button>
          </form>

          <div className="lg:col-span-2">
            <ul className="flex flex-col gap-2">
              {insts.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 p-4">
                  <div>
                    <div className="font-medium text-slate-900">{i.nome}</div>
                    <div className="text-xs text-slate-500">
                      {i.sistemas.join(", ") || "sem sistemas"} · {i.totais?.alunos ?? 0} alunos · {i.totais?.usuarios ?? 0} usuários
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${i.status === "ativo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {i.status}
                    </span>
                    <button
                      onClick={() =>
                        pedirConfirmacao(`${i.status === "ativo" ? "Suspender" : "Reativar"} ${i.nome}`, async () => {
                          await api.post(`/admin-global/instituicoes/${i.id}/status`, {
                            status: i.status === "ativo" ? "suspenso" : "ativo",
                            confirmacao: true,
                          });
                        })
                      }
                      className="text-slate-600 hover:underline"
                    >
                      {i.status === "ativo" ? "Suspender" : "Reativar"}
                    </button>
                    <button
                      onClick={() =>
                        pedirConfirmacao(`Excluir DEFINITIVAMENTE ${i.nome} e todos os seus dados`, async () => {
                          await api.delete(`/admin-global/instituicoes/${i.id}`, { confirmacao: true });
                        })
                      }
                      className="text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {aba === "stats" && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(stats).filter(([k]) => k !== "planos").map(([k, v]) => (
            <div key={k} className="rounded-md border border-slate-100 p-4 shadow-sm">
              <div className="text-2xl font-semibold text-slate-900">{String(v)}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</div>
            </div>
          ))}
          <div className="col-span-full rounded-md border border-slate-100 p-4 text-sm text-slate-600">
            Planos: {JSON.stringify(stats.planos)}
          </div>
        </div>
      )}

      {aba === "audit" && (
        <div className="overflow-x-auto rounded-md border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Instituição</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(l.timestamp).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.usuario.slice(0, 10)}…</td>
                  <td className="px-4 py-2">{l.acao}</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.instituicao ?? "—"}</td>
                  <td className="px-4 py-2">{l.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmarAcao
        aberto={!!acao}
        mensagem={`Você tem certeza que deseja realizar esta ação? (${acao?.rotulo})`}
        onCancelar={() => setAcao(null)}
        onConfirmar={confirmar}
      />
    </AppShell>
  );
}
