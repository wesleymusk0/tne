"use client";

import { useCallback, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX"];
const TURNOS_PADRAO = {
  manha: ["07:00", "07:50", "08:40", "09:50"],
  tarde: ["13:00", "13:50", "14:40", "15:50"],
  noite: ["18:00", "18:50", "19:40", "20:50"],
};

interface Professor {
  nome: string;
  aulas_geminadas: string;
  ha_geminada: string;
  ha_qtd: number;
  disponibilidade: string[][];
  disponibilidade_ha: string[][];
}

interface Turma {
  nome: string;
  aulas: number;
}

interface Regra {
  tipo: string;
  turma?: string;
  materia?: string;
  materia_2?: string;
  professor?: string;
  dia_indice?: number | "";
  aula_indice?: number | "";
  valor?: number;
}

interface ResultadoHorario {
  sucesso: boolean;
  mensagem: string;
  horarios_turmas?: Record<string, string[][]>;
  horarios_professores?: Record<string, string[][]>;
}

const MODOS = [
  { id: "gerar", rotulo: "Gerar padrão", endpoint: "/engines/horia/gerar" },
  { id: "janelas", rotulo: "Otimizar janelas", endpoint: "/engines/horia/otimizar_janelas" },
  { id: "carga", rotulo: "Balancear carga", endpoint: "/engines/horia/balancear_carga" },
  { id: "ha", rotulo: "Alocar HA", endpoint: "/engines/horia/alocar_ha" },
  { id: "dias", rotulo: "Reduzir dias", endpoint: "/engines/horia/otimizar_dias" },
] as const;

type Aba = "config" | "turmas" | "materias" | "professores" | "grade" | "fixos" | "regras" | "gerar";

export default function HoriaPage() {
  const { tenantAtivo } = useAuth();
  const [aba, setAba] = useState<Aba>("config");
  const [turno, setTurno] = useState<keyof typeof TURNOS_PADRAO>("manha");
  const [usaHa, setUsaHa] = useState(true);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<string[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [grade, setGrade] = useState<Record<string, Record<string, number>>>({});
  const [profDisc, setProfDisc] = useState<Record<string, Record<string, string>>>({});
  const [fixos, setFixos] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [regras, setRegras] = useState<Regra[]>([]);
  const [resultado, setResultado] = useState<ResultadoHorario | null>(null);
  const [msg, setMsg] = useState("");
  const [verProfessores, setVerProfessores] = useState(false);

  const horarios = TURNOS_PADRAO[turno];
  const menuItens = [
    { href: "/dashboard", rotulo: "Dashboard", icone: "🏠" },
    { href: "/sistemas/horia", rotulo: "HorIA", icone: "🕐" },
  ];

  const novoProfessor = useCallback((): Professor => ({
    nome: "",
    aulas_geminadas: "indiferente",
    ha_geminada: "indiferente",
    ha_qtd: 0,
    disponibilidade: horarios.map(() => DIAS.map(() => "DISPONÍVEL")),
    disponibilidade_ha: horarios.map(() => DIAS.map(() => "DISPONÍVEL")),
  }), [horarios]);

  function alternarDisp(idx: number, r: number, c: number, ha: boolean) {
    setProfessores((ps) =>
      ps.map((p, i) => {
        if (i !== idx) return p;
        const chave = ha ? "disponibilidade_ha" : "disponibilidade";
        const grid = p[chave].map((row, ri) =>
          ri === r ? row.map((v, ci) => (ci === c ? (v === "DISPONÍVEL" ? "INDISPONÍVEL" : "DISPONÍVEL") : v)) : row
        );
        return { ...p, [chave]: grid };
      })
    );
  }

  const payload = useMemo(() => ({
    tenantId: tenantAtivo ?? undefined,
    escola_info: { nome: "Escola", turno, aulas: horarios.length, dias: DIAS.length, usa_ha: usaHa },
    horarios,
    dias_semana: DIAS,
    turmas: turmas.map((t) => ({ nome: t.nome, aulas: 0 })),
    materias: materias.map((nome) => ({ nome })),
    professores,
    grade_curricular: grade,
    prof_disc: profDisc,
    fixos,
    regras_personalizadas: regras,
  }), [tenantAtivo, turno, usaHa, turmas, materias, professores, grade, profDisc, fixos, regras, horarios]);

  async function gerar(endpoint: string) {
    setMsg("Gerando... pode levar alguns segundos.");
    setResultado(null);
    try {
      const r = await api.post<ResultadoHorario>(endpoint, payload);
      setResultado(r);
      setMsg(r.mensagem);
    } catch (err) {
      setResultado(null);
      setMsg(err instanceof ApiError ? err.message : "Erro ao gerar horário.");
    }
  }

  const turmasNovo = (t: Turma) => setTurmas((prev) => [...prev, t]);

  return (
    <AppShell titulo="HorIA — Geração de Horários" itens={menuItens}>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-100">
        {(
          [
            ["config", "Configuração"],
            ["turmas", "Turmas"],
            ["materias", "Matérias"],
            ["professores", "Professores"],
            ["grade", "Grade curricular"],
            ["fixos", "Fixações"],
            ["regras", "Regras"],
            ["gerar", "Gerar"],
          ] as [Aba, string][]
        ).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${aba === id ? "bg-blue-100 text-blue-800" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "config" && (
        <div className="max-w-md flex flex-col gap-3 rounded-xl border border-slate-100 p-4 text-sm">
          <label className="font-medium text-slate-700">Turno</label>
          <select className="rounded-lg border border-slate-200 px-3 py-2" value={turno} onChange={(e) => setTurno(e.target.value as keyof typeof TURNOS_PADRAO)}>
            {Object.keys(TURNOS_PADRAO).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={usaHa} onChange={(e) => setUsaHa(e.target.checked)} />
            Hora-Atividade (HA)
          </label>
          <p className="text-xs text-slate-500">Dias: {DIAS.join(", ")} · {horarios.length} aulas/dia ({horarios.join(", ")})</p>
        </div>
      )}

      {aba === "turmas" && (
        <div className="max-w-xl flex flex-col gap-3">
          <div className="flex gap-2">
            <input id="turma-nome" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nome da turma" />
            <button
              onClick={() => {
                const el = document.getElementById("turma-nome") as HTMLInputElement;
                if (el.value.trim()) turmasNovo({ nome: el.value.trim(), aulas: 0 });
                el.value = "";
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Adicionar
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {turmas.map((t, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                {t.nome}
                <button onClick={() => setTurmas(turmas.filter((_, j) => j !== i))} className="text-red-600">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aba === "materias" && (
        <div className="max-w-xl flex flex-col gap-3">
          <div className="flex gap-2">
            <input id="materia-nome" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nome da matéria" />
            <button
              onClick={() => {
                const el = document.getElementById("materia-nome") as HTMLInputElement;
                if (el.value.trim()) setMaterias((prev) => [...prev, el.value.trim()]);
                el.value = "";
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Adicionar
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {materias.map((m, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                {m}
                <button onClick={() => setMaterias(materias.filter((_, j) => j !== i))} className="text-red-600">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aba === "professores" && (
        <div className="flex flex-col gap-4">
          <button onClick={() => setProfessores((p) => [...p, novoProfessor()])} className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            + Novo professor
          </button>
          {professores.map((p, idx) => (
            <div key={idx} className="rounded-xl border border-slate-100 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Nome"
                  value={p.nome}
                  onChange={(e) => setProfessores(professores.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)))}
                />
                <select
                  value={p.aulas_geminadas}
                  onChange={(e) => setProfessores(professores.map((x, i) => (i === idx ? { ...x, aulas_geminadas: e.target.value } : x)))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="indiferente">Geminação: indiferente</option>
                  <option value="sim">Geminação: sim</option>
                  <option value="não">Geminação: não</option>
                </select>
                {usaHa && (
                  <>
                    <label className="text-sm text-slate-600">HA:</label>
                    <input
                      className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      value={p.ha_qtd}
                      onChange={(e) => setProfessores(professores.map((x, i) => (i === idx ? { ...x, ha_qtd: Number(e.target.value) || 0 } : x)))}
                    />
                    <select
                      value={p.ha_geminada}
                      onChange={(e) => setProfessores(professores.map((x, i) => (i === idx ? { ...x, ha_geminada: e.target.value } : x)))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="indiferente">HA geminada: indiferente</option>
                      <option value="sim">HA geminada: sim</option>
                      <option value="não">HA geminada: não</option>
                    </select>
                  </>
                )}
                <button onClick={() => setProfessores(professores.filter((_, i) => i !== idx))} className="text-sm text-red-600">✕</button>
              </div>
              {(["disponibilidade", "disponibilidade_ha"] as const).map((chave, gi) =>
                (chave === "disponibilidade" || usaHa) && (
                  <div key={chave} className="mt-3">
                    <div className="mb-1 text-xs font-medium text-slate-500">
                      {chave === "disponibilidade" ? "Disponibilidade" : "Disponibilidade para HA"}
                    </div>
                    <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${DIAS.length + 1}, auto)` }}>
                      <span />
                      {DIAS.map((d) => (
                        <span key={d} className="text-center text-[10px] font-medium text-slate-400">{d}</span>
                      ))}
                      {p[chave].map((row, r) => (
                        <span key={`h${r}`} className="contents">
                          <span className="pr-1 text-[10px] text-slate-400">{horarios[r]}</span>
                          {row.map((v, c) => (
                            <button
                              key={c}
                              onClick={() => alternarDisp(idx, r, c, gi === 1)}
                              className={`h-6 w-10 rounded text-[10px] font-medium ${v === "DISPONÍVEL" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {v === "DISPONÍVEL" ? "ok" : "—"}
                            </button>
                          ))}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {aba === "grade" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Defina aulas semanais por matéria e o professor de cada uma.</p>
          {turmas.map((t, ti) => (
            <div key={ti} className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-medium text-slate-900">{t.nome}</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {materias.map((m) => (
                  <div key={m} className="flex items-center gap-2 text-sm">
                    <span className="w-32 text-slate-600">{m}</span>
                    <input
                      className="w-14 rounded border border-slate-200 px-2 py-1 text-center"
                      value={grade[t.nome]?.[m] ?? ""}
                      placeholder="0"
                      onChange={(e) =>
                        setGrade({
                          ...grade,
                          [t.nome]: { ...grade[t.nome], [m]: Number(e.target.value) || 0 },
                        })
                      }
                    />
                    <select
                      className="rounded border border-slate-200 px-2 py-1"
                      value={profDisc[t.nome]?.[m] ?? ""}
                      onChange={(e) =>
                        setProfDisc({
                          ...profDisc,
                          [t.nome]: { ...profDisc[t.nome], [m]: e.target.value },
                        })
                      }
                    >
                      <option value="">Professor</option>
                      {professores.map((p) => (
                        <option key={p.nome} value={p.nome}>{p.nome || "(sem nome)"}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {aba === "fixos" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Fixe matérias em horários específicos (clique e selecione; útil para congelar parte da grade).
          </p>
          {turmas.map((t) => (
            <div key={t.nome} className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-medium text-slate-900">{t.nome}</h3>
              <div className="mt-2 inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${DIAS.length + 1}, auto)` }}>
                <span />
                {DIAS.map((d) => (
                  <span key={d} className="text-center text-xs font-medium text-slate-400">{d}</span>
                ))}
                {horarios.map((h, r) => (
                  <span key={h} className="contents">
                    <span className="pr-1 text-xs text-slate-400">{h}</span>
                    {DIAS.map((_, c) => {
                      const atual = fixos[t.nome]?.[String(r)]?.[String(c)];
                      return (
                        <select
                          key={c}
                          className="h-8 w-28 rounded border border-slate-200 px-1 text-xs"
                          value={atual ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFixos((prev) => {
                              const turma = { ...(prev[t.nome] ?? {}) };
                              const dia = { ...(turma[String(r)] ?? {}) };
                              if (v) dia[String(c)] = v;
                              else delete dia[String(c)];
                              turma[String(r)] = dia;
                              return { ...prev, [t.nome]: turma };
                            });
                          }}
                        >
                          <option value="">—</option>
                          {materias.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      );
                    })}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {aba === "regras" && (
        <div className="flex max-w-3xl flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { tipo: "limite_diario", rotulo: "+ Limite diário" },
              { tipo: "bloqueio_horario", rotulo: "+ Bloqueio de horário" },
              { tipo: "incompatibilidade", rotulo: "+ Incompatibilidade" },
              { tipo: "aulas_simultaneas", rotulo: "+ Aulas simultâneas" },
            ].map((b) => (
              <button
                key={b.tipo}
                onClick={() => setRegras((prev) => [...prev, { tipo: b.tipo, valor: 2 }])}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                {b.rotulo}
              </button>
            ))}
          </div>
          {regras.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-3 text-xs">
              <span className="rounded bg-primary-50 px-2 py-0.5 font-medium text-primary">{r.tipo}</span>
              <select className="rounded border border-slate-200 px-2 py-1" value={r.turma ?? ""} onChange={(e) => definirRegra(i, "turma", e.target.value || undefined)}>
                <option value="">Todas as turmas</option>
                {turmas.map((t) => (
                  <option key={t.nome} value={t.nome}>{t.nome}</option>
                ))}
              </select>
              <select className="rounded border border-slate-200 px-2 py-1" value={r.materia ?? ""} onChange={(e) => definirRegra(i, "materia", e.target.value || undefined)}>
                <option value="">Toda matéria</option>
                {materias.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {(r.tipo === "incompatibilidade" || r.tipo === "aulas_simultaneas" || r.tipo === "limite_diario") && (
                <select className="rounded border border-slate-200 px-2 py-1" value={r.materia_2 ?? ""} onChange={(e) => definirRegra(i, "materia_2", e.target.value || undefined)}>
                  <option value="">{r.tipo === "limite_diario" ? "Exceção" : "Matéria 2"}</option>
                  {materias.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
              {r.tipo === "limite_diario" && (
                <input
                  className="w-12 rounded border border-slate-200 px-2 py-1 text-center"
                  value={r.valor ?? 2}
                  onChange={(e) => definirRegra(i, "valor", Number(e.target.value) || 2)}
                />
              )}
              {r.tipo === "bloqueio_horario" && (
                <>
                  <select className="rounded border border-slate-200 px-2 py-1" value={r.dia_indice ?? ""} onChange={(e) => definirRegra(i, "dia_indice", e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">Todo dia</option>
                    {DIAS.map((d, k) => (
                      <option key={d} value={k}>{d}</option>
                    ))}
                  </select>
                  <select className="rounded border border-slate-200 px-2 py-1" value={r.aula_indice ?? ""} onChange={(e) => definirRegra(i, "aula_indice", e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">Toda aula</option>
                    {horarios.map((h, k) => (
                      <option key={h} value={k}>{h}</option>
                    ))}
                  </select>
                  <select className="rounded border border-slate-200 px-2 py-1" value={r.professor ?? ""} onChange={(e) => definirRegra(i, "professor", e.target.value || undefined)}>
                    <option value="">Todo professor</option>
                    {professores.map((p) => (
                      <option key={p.nome} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>
                </>
              )}
              <button onClick={() => setRegras(regras.filter((_, j) => j !== i))} className="text-red-600">✕</button>
            </div>
          ))}
        </div>
      )}

      {aba === "gerar" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => gerar(m.endpoint)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
                disabled={m.id === "ha" && !usaHa}
              >
                {m.rotulo}
              </button>
            ))}
            {resultado?.sucesso && (
              <button onClick={() => setVerProfessores((v) => !v)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                {verProfessores ? "Ver por turmas" : "Ver por professores"}
              </button>
            )}
          </div>
          {msg && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{msg}</p>}
          {resultado?.sucesso && (
            <div className="flex flex-col gap-4">
              {Object.entries(verProfessores ? resultado.horarios_professores ?? {} : resultado.horarios_turmas ?? {}).map(([nome, gradeD]) => (
                <div key={nome} className="rounded-xl border border-slate-100 p-4">
                  <h3 className="font-medium text-slate-900">{nome}</h3>
                  <div className="mt-2 inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${DIAS.length + 1}, auto)` }}>
                    <span />
                    {DIAS.map((d) => (
                      <span key={d} className="text-center text-xs font-medium text-slate-400">{d}</span>
                    ))}
                    {gradeD.map((aulasD, r) => (
                      <span key={r} className="contents">
                        <span className="pr-1 text-xs text-slate-400">{horarios[r]}</span>
                        {aulasD.map((v, c) => (
                          <span key={c} className={`min-w-28 whitespace-pre-wrap rounded px-1.5 py-1 text-xs ${v ? "bg-primary-50 text-slate-800" : "bg-slate-50 text-slate-300"}`}>
                            {v || "—"}
                          </span>
                        ))}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => window.print()} className="w-fit rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Imprimir
              </button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );

  function definirRegra(idx: number, campo: string, valor: unknown) {
    setRegras((prev) => prev.map((r, i) => (i === idx ? { ...r, [campo]: valor } : r)));
  }
}
