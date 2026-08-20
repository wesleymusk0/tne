"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell, ConfirmarAcao } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMenuItens } from "@/lib/menu";

const ABAS = ["Convites", "Cargos", "Regras", "Personalização", "Studio"] as const;

interface Cargo {
  id: string;
  nome: string;
  padrao?: boolean;
  permissoes?: Record<string, Record<string, boolean>>;
}

interface Regra {
  id: string;
  sistema: string;
  periodo: string;
  limite: number;
  ativa: boolean;
}

interface Convite {
  token: string;
  email: string;
  nome: string;
  status: string;
}

const SISTEMAS = ["mapia", "horia", "somatoria", "remanejia", "buscia", "domicilia", "notas", "presenca", "avalia", "provia", "tri"];
const ACOES = ["visualizar", "criar", "editar", "excluir", "emitir", "gerenciar"];
const PERIODOS = ["semana", "mes", "trimestre", "semestre", "ano", "total"];

export default function InstituicaoPage() {
  const { perfil, tenantAtivo, recarregarPerfil } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Convites");
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [msg, setMsg] = useState("");
  const [conflito, setConflito] = useState<{ mensagem: string; pendentes: Record<string, unknown> } | null>(null);

  // convite
  const [convNome, setConvNome] = useState("");
  const [convEmail, setConvEmail] = useState("");
  const [convCargo, setConvCargo] = useState("professor");
  // cargo
  const [cargoNome, setCargoNome] = useState("");
  const [cargoPerms, setCargoPerms] = useState<Record<string, Record<string, boolean>>>({});
  // regra
  const [regraSistema, setRegraSistema] = useState("mapia");
  const [regraPeriodo, setRegraPeriodo] = useState("trimestre");
  const [regraLimite, setRegraLimite] = useState("3");
  // personalização
  const [nomeInst, setNomeInst] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const carregar = useCallback(() => {
    if (!tenantAtivo) return;
    api.get<{ cargos: Cargo[] }>(`/tenants/${tenantAtivo}/cargos`).then((r) => {
      setCargos(r.cargos);
      setConvCargo((atual) => atual || r.cargos.find((c) => c.id === "professor")?.id || r.cargos[0]?.id || "");
    }).catch(() => undefined);
    api.get<{ regras: Regra[] }>(`/tenants/${tenantAtivo}/regras`).then((r) => setRegras(r.regras)).catch(() => undefined);
    api.get<{ convites: Convite[] }>(`/tenants/${tenantAtivo}/convites`).then((r) => setConvites(r.convites)).catch(() => undefined);
    api.get<{ info: { nome?: string }; personalizacao: { nome?: string; logoUrl?: string } }>(`/tenants/${tenantAtivo}`)
      .then((r) => {
        setNomeInst(r.personalizacao?.nome ?? r.info?.nome ?? "");
        setLogoUrl(r.personalizacao?.logoUrl ?? "");
      })
      .catch(() => undefined);
  }, [tenantAtivo]);

  useEffect(carregar, [carregar]);

  async function criarConvite(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const r = await api.post<{ token: string }>(`/tenants/${tenantAtivo}/convites`, {
        nome: convNome, email: convEmail, cargo: convCargo,
      });
      setMsg(`Convite criado. Link: ${window.location.origin}/login?convite=${r.token}`);
      setConvNome("");
      setConvEmail("");
      carregar();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao criar convite.");
    }
  }

  async function criarCargo(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api.post(`/tenants/${tenantAtivo}/cargos`, { nome: cargoNome, permissoes: cargoPerms });
      setMsg("Cargo criado.");
      setCargoNome("");
      setCargoPerms({});
      carregar();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao criar cargo.");
    }
  }

  async function salvarRegra(confirmarConflito = false) {
    setMsg("");
    const body = { sistema: regraSistema, periodo: regraPeriodo, limite: parseInt(regraLimite, 10), confirmarConflito };
    try {
      const r = await api.post<{ sucesso: boolean; conflito?: boolean; mensagem?: string }>(
        `/tenants/${tenantAtivo}/regras`, body
      );
      if (r.conflito) {
        setConflito({ mensagem: r.mensagem ?? "Conflito detectado.", pendentes: body });
        return;
      }
      setMsg("Regra salva.");
      carregar();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao salvar regra.");
    }
  }

  async function salvarPersonalizacao(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api.put(`/tenants/${tenantAtivo}/personalizacao`, { nome: nomeInst, logoUrl });
      setMsg("Personalização salva.");
      await recarregarPerfil();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao salvar.");
    }
  }

  if (!tenantAtivo) {
    return (
      <AppShell titulo="Instituição" itens={itens}>
        <p className="text-sm text-slate-500">Selecione uma instituição no Dashboard.</p>
      </AppShell>
    );
  }

  const campo = "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <AppShell titulo="Instituição" itens={itens}>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-100">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium ${
              aba === a ? "bg-blue-100 text-blue-800" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      {msg && <p className="mb-4 break-all rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{msg}</p>}

      {aba === "Convites" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={criarConvite} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4">
            <h2 className="font-medium text-slate-900">Convidar usuário</h2>
            <input className={campo} placeholder="Nome" value={convNome} onChange={(e) => setConvNome(e.target.value)} required />
            <input className={campo} type="email" placeholder="E-mail" value={convEmail} onChange={(e) => setConvEmail(e.target.value)} required />
            <select className={campo} value={convCargo} onChange={(e) => setConvCargo(e.target.value)}>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Sem senha: o usuário fica pendente e ativa ao se registrar com este e-mail.</p>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">Criar convite</button>
          </form>
          <div className="rounded-xl border border-slate-100 p-4">
            <h2 className="mb-3 font-medium text-slate-900">Convites enviados</h2>
            {convites.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum convite.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {convites.map((c) => (
                  <li key={c.token} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>{c.nome} — {c.email}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "pendente" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {aba === "Cargos" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={criarCargo} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4">
            <h2 className="font-medium text-slate-900">Novo cargo</h2>
            <input className={campo} placeholder="Nome (ex.: Pedagogo)" value={cargoNome} onChange={(e) => setCargoNome(e.target.value)} required />
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-100 p-3">
              {SISTEMAS.map((s) => (
                <div key={s} className="mb-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">{s}</div>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {ACOES.map((a) => (
                      <label key={a} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={!!cargoPerms[s]?.[a]}
                          onChange={(e) =>
                            setCargoPerms((prev) => ({
                              ...prev,
                              [s]: { ...prev[s], [a]: e.target.checked },
                            }))
                          }
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">Criar cargo</button>
          </form>
          <div className="rounded-xl border border-slate-100 p-4">
            <h2 className="mb-3 font-medium text-slate-900">Cargos existentes</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {cargos.map((c) => (
                <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="font-medium text-slate-900">
                    {c.nome} {c.padrao && <span className="text-xs text-slate-400">(padrão)</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {Object.entries(c.permissoes ?? {})
                      .filter(([s]) => !s.startsWith("_"))
                      .map(([s, a]) => `${s}: ${Object.entries(a).filter(([, v]) => v).map(([k]) => k).join("/") || "—"}`)
                      .join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {aba === "Regras" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvarRegra();
            }}
            className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4"
          >
            <h2 className="font-medium text-slate-900">Nova regra institucional</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span>Máximo de</span>
              <input className={`${campo} w-20`} inputMode="numeric" value={regraLimite} onChange={(e) => setRegraLimite(e.target.value)} required />
              <select className={campo} value={regraSistema} onChange={(e) => setRegraSistema(e.target.value)}>
                {SISTEMAS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span>por</span>
              <select className={campo} value={regraPeriodo} onChange={(e) => setRegraPeriodo(e.target.value)}>
                {PERIODOS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              A regra é executada literalmente: “3 por trimestre” permite 3 no trimestre, diferente de “1 por mês”.
            </p>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">Salvar regra</button>
          </form>
          <div className="rounded-xl border border-slate-100 p-4">
            <h2 className="mb-3 font-medium text-slate-900">Regras ativas</h2>
            {regras.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma regra configurada.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {regras.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>
                      Máx. {r.limite} {r.sistema} por {r.periodo}
                      {!r.ativa && <span className="ml-2 text-xs text-slate-400">(inativa)</span>}
                    </span>
                    <button
                      onClick={() => api.delete(`/tenants/${tenantAtivo}/regras/${r.id}`).then(carregar)}
                      className="text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {aba === "Personalização" && (
        <form onSubmit={salvarPersonalizacao} className="flex max-w-lg flex-col gap-3 rounded-xl border border-slate-100 p-4">
          <h2 className="font-medium text-slate-900">Identidade da instituição</h2>
          <label className="text-xs font-medium text-slate-500">Nome exibido</label>
          <input className={campo} value={nomeInst} onChange={(e) => setNomeInst(e.target.value)} />
          <label className="text-xs font-medium text-slate-500">URL do logo</label>
          <input className={campo} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
          <p className="text-xs text-slate-500">
            O nome e o logo Systematrix permanecem sempre visíveis; a instituição pode adicionar os seus.
          </p>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">Salvar</button>
        </form>
      )}

      {aba === "Studio" && <StudioTab tenantId={tenantAtivo} campo={campo} />}
    </AppShell>
  );
}

function StudioTab({ tenantId, campo }: { tenantId: string; campo: string }) {
  interface Automacao {
    id: string;
    nome: string;
    agendamento: string;
    acao: { tipo: string };
    ativa: boolean;
  }
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [acoes, setAcoes] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [acao, setAcao] = useState("");
  const [cron, setCron] = useState("0 7 * * 1-5");
  const [resultado, setResultado] = useState("");

  const carregar = useCallback(() => {
    api.get<{ automacoes: Automacao[]; acoesDisponiveis: string[] }>(`/studio/${tenantId}/automacoes`).then((r) => {
      setAutomacoes(r.automacoes);
      setAcoes(r.acoesDisponiveis);
      setAcao((atual) => atual || r.acoesDisponiveis[0] || "");
    }).catch(() => undefined);
  }, [tenantId]);

  useEffect(carregar, [carregar]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await api.post(`/studio/${tenantId}/automacoes`, { nome, agendamento: cron, acao: { tipo: acao } });
          setNome("");
          carregar();
        }}
        className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4"
      >
        <h2 className="font-medium text-slate-900">Nova automação</h2>
        <input className={campo} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <select className={campo} value={acao} onChange={(e) => setAcao(e.target.value)}>
          {acoes.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input className={campo} value={cron} onChange={(e) => setCron(e.target.value)} placeholder="min hora dia mês semana" />
        <p className="text-xs text-slate-500">Agendamento cron: minuto hora dia-do-mês mês dia-da-semana.</p>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">Criar automação</button>
        {resultado && <p className="text-sm text-slate-600">{resultado}</p>}
      </form>
      <div className="rounded-xl border border-slate-100 p-4">
        <h2 className="mb-3 font-medium text-slate-900">Automações</h2>
        {automacoes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma automação configurada.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {automacoes.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>
                  {a.nome} <span className="text-xs text-slate-400">({a.acao.tipo} · {a.agendamento})</span>
                </span>
                <button
                  onClick={async () => {
                    const r = await api.post<{ resultado: Record<string, unknown> }>(`/studio/${tenantId}/automacoes/${a.id}/executar`, {});
                    setResultado(JSON.stringify(r.resultado));
                  }}
                  className="text-primary-600 hover:underline"
                >
                  Executar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
