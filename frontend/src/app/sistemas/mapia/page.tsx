"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import {
  FerramentaPixel,
  MARCAS_VAZIAS,
  MarcasGrade,
  PixelGrid,
  PreviewSala,
} from "@/components/MapiaGrade";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { menuParaSistema } from "@/lib/menu";

type LayoutId = "tradicional" | "u" | "grupos" | "roda";

interface AlunoMapia {
  name: string;
  pcd?: boolean;
  vision?: boolean;
  hearing?: boolean;
  autism?: boolean;
  tall?: boolean;
  shortStudent?: boolean;
  talksWith?: string[];
  tod?: boolean;
  intellectualDisability?: boolean;
  adhd?: boolean;
}

const FLAGS: { campo: keyof AlunoMapia; rotulo: string }[] = [
  { campo: "pcd", rotulo: "PCD / mobilidade" },
  { campo: "vision", rotulo: "Visão" },
  { campo: "hearing", rotulo: "Audição" },
  { campo: "autism", rotulo: "Autismo" },
  { campo: "tall", rotulo: "Alto(a)" },
  { campo: "shortStudent", rotulo: "Baixo(a)" },
  { campo: "tod", rotulo: "TOD" },
  { campo: "intellectualDisability", rotulo: "Def. intelectual" },
  { campo: "adhd", rotulo: "TDAH" },
];

interface Versao {
  numero: number;
  criadoEm: number;
  arrangement: { name: string; seat: string }[];
}

interface DadosProjeto {
  alunos?: AlunoMapia[];
  layout?: LayoutId;
  colunas?: number;
  tamanhoGrupo?: number;
  carteirasPorColuna?: Record<number, number>;
  marcas?: { door: string[]; prof: string[]; window: string[] };
  versoes?: Versao[];
}

interface Projeto {
  id: string;
  nome: string;
  dados: DadosProjeto;
  criadoEm: number;
}

interface GrupoConversa {
  membros: string[];
}

function marcasParaArrays(m: MarcasGrade) {
  return { door: [...m.door], prof: [...m.prof], window: [...m.window] };
}

function arraysParaMarcas(a: { door: string[]; prof: string[]; window: string[] }): MarcasGrade {
  return { door: new Set(a.door ?? []), prof: new Set(a.prof ?? []), window: new Set(a.window ?? []) };
}

function gruposDeTalksWith(lista: AlunoMapia[]): GrupoConversa[] {
  const gruposAgrupados: GrupoConversa[] = [];
  const vistos = new Set<string>();
  for (const a of lista) {
    for (const amigo of a.talksWith ?? []) {
      const par = [a.name, amigo].sort().join("⇔");
      if (!vistos.has(par)) {
        vistos.add(par);
        gruposAgrupados.push({ membros: [a.name, amigo] });
      }
    }
  }
  return gruposAgrupados;
}

function sincronizarTalksWith(lista: AlunoMapia[], listaGrupos: GrupoConversa[]): AlunoMapia[] {
  return lista.map((a) => ({
    ...a,
    talksWith: listaGrupos
      .filter((g) => g.membros.includes(a.name))
      .flatMap((g) => g.membros.filter((m) => m !== a.name)),
  }));
}

export default function MapiaPage() {
  const { tenantAtivo } = useAuth();
  const itens = menuParaSistema("mapia");

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [nome, setNome] = useState("");

  const [alunos, setAlunos] = useState<AlunoMapia[]>([]);
  const [novoAluno, setNovoAluno] = useState("");
  const [grupos, setGrupos] = useState<GrupoConversa[]>([]);
  const [novoGrupo, setNovoGrupo] = useState("");
  const [layout, setLayout] = useState<LayoutId>("tradicional");
  const [colunas, setColunas] = useState(3);
  const [tamanhoGrupo, setTamanhoGrupo] = useState(4);
  const [marcas, setMarcas] = useState<MarcasGrade>(MARCAS_VAZIAS());
  const [ferramenta, setFerramenta] = useState<FerramentaPixel>("porta");

  const [arrangement, setArrangement] = useState<{ name: string; seat: string }[] | null>(null);
  const [versaoSel, setVersaoSel] = useState<number | null>(null);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [gerando, setGerando] = useState(false);

  const carregarProjetos = useCallback(() => {
    const qs = tenantAtivo ? `?tenantId=${tenantAtivo}` : "";
    api.get<{ projetos: Projeto[] }>(`/projetos/mapia${qs}`).then((r) => setProjetos(r.projetos)).catch(() => setProjetos([]));
  }, [tenantAtivo]);

  useEffect(carregarProjetos, [carregarProjetos]);

  const numeroAlunos = alunos.length;

  // mapeamento layout → grade do engine (preserva a matemática 1:1)
  const { cols, carteirasPorColuna } = useMemo(() => {
    if (layout === "roda") {
      const c = Math.max(1, numeroAlunos);
      return { cols: c, carteirasPorColuna: Object.fromEntries(Array.from({ length: c }, (_, i) => [i + 1, 1])) };
    }
    if (layout === "grupos") {
      const c = tamanhoGrupo;
      const gruposN = Math.max(1, Math.ceil(numeroAlunos / c));
      return { cols: c, carteirasPorColuna: Object.fromEntries(Array.from({ length: c }, (_, i) => [i + 1, gruposN])) };
    }
    if (layout === "u") {
      const porBraco = Math.max(1, Math.ceil(numeroAlunos / 2));
      return { cols: 2, carteirasPorColuna: { 1: porBraco, 2: porBraco } };
    }
    const c = Math.min(10, Math.max(1, colunas));
    const porCol = Math.max(1, Math.ceil(numeroAlunos / c));
    return { cols: c, carteirasPorColuna: Object.fromEntries(Array.from({ length: c }, (_, i) => [i + 1, porCol])) };
  }, [layout, colunas, tamanhoGrupo, numeroAlunos]);

  const carregarProjeto = useCallback((p: Projeto) => {
    setProjeto(p);
    setNome(p.nome);
    const d = p.dados ?? {};
    setAlunos(d.alunos ?? []);
    setGrupos(gruposDeTalksWith(d.alunos ?? []));
    setLayout(d.layout ?? "tradicional");
    setColunas(d.colunas ?? 3);
    setTamanhoGrupo(d.tamanhoGrupo ?? 4);
    setMarcas(d.marcas ? arraysParaMarcas(d.marcas) : MARCAS_VAZIAS());
    const versoes = d.versoes ?? [];
    setArrangement(versoes[versoes.length - 1]?.arrangement ?? null);
    setVersaoSel(versoes.length ? versoes[versoes.length - 1].numero : null);
    setMsg("");
  }, []);

  function adicionarAluno() {
    const nomeLimpo = novoAluno.trim();
    if (!nomeLimpo) return;
    setAlunos((prev) => [...prev, { name: nomeLimpo }]);
    setNovoAluno("");
  }

  function importarDaGestao() {
    if (!tenantAtivo) {
      setMsg("Importação direta exige contexto institucional. Você também pode digitar os nomes acima.");
      return;
    }
    api.get<{ alunos: Record<string, unknown>[] }>(`/academico/${tenantAtivo}/alunos`).then((r) => {
      const lista: AlunoMapia[] = r.alunos.map((a) => ({
        name: String(a.nome ?? ""),
        pcd: !!(a.cadeirante || a.defMotora),
        vision: !!(a.defVisual || a.oculos),
        hearing: !!a.defAuditiva,
        autism: !!a.autismo,
        tall: a.altura === "alta",
        shortStudent: a.altura === "baixa",
        tod: !!a.tod,
        intellectualDisability: !!a.defIntelectual,
        adhd: !!a.tdah,
      }));
      setAlunos(lista);
      setGrupos(gruposDeTalksWith(lista));
      setMsg(`${lista.length} alunos importados da Gestão de Alunos.`);
    }).catch(() => setMsg("Falha ao importar alunos."));
  }

  function adicionarGrupo() {
    const membros = novoGrupo.split(",").map((m) => m.trim()).filter(Boolean);
    if (membros.length >= 2) {
      const novos = [...grupos, { membros }];
      setGrupos(novos);
      setAlunos((prev) => sincronizarTalksWith(prev, novos));
    }
    setNovoGrupo("");
  }

  async function gerar() {
    if (alunos.length === 0) {
      setMsg("Adicione os alunos antes de gerar o mapa.");
      return;
    }
    setGerando(true);
    setMsg("");
    try {
      let projetoId = projeto?.id;
      if (!projetoId) {
        const criado = await api.post<{ projetoId: string }>("/projetos/mapia", {
          tenantId: tenantAtivo ?? undefined,
          nome: nome || `Mapa ${new Date().toLocaleDateString("pt-BR")}`,
          dados: {
            alunos,
            layout,
            colunas: cols,
            tamanhoGrupo,
            carteirasPorColuna,
            marcas: marcasParaArrays(marcas),
            versoes: [],
          },
        });
        projetoId = criado.projetoId;
      }
      const r = await api.post<{ sucesso: boolean; arrangement: { name: string; seat: string }[] }>("/engines/mapia/gerar", {
        tenantId: tenantAtivo ?? undefined,
        students: alunos,
        columns: cols,
        carteirasPorColuna,
        doorPixelCells: [...marcas.door],
        profPixelCells: [...marcas.prof],
        windowPixelCells: [...marcas.window],
      });
      if (!r.sucesso) throw new ApiError(500, "Falha ao gerar o mapa.");

      const versao: Versao = {
        numero: (projeto?.dados.versoes?.length ?? 0) + 1,
        criadoEm: Date.now(),
        arrangement: r.arrangement,
      };
      const dados: DadosProjeto = {
        alunos,
        layout,
        colunas: cols,
        tamanhoGrupo,
        carteirasPorColuna,
        marcas: marcasParaArrays(marcas),
        versoes: [...(projeto?.dados.versoes ?? []), versao],
      };
      await api.put(`/projetos/mapia/${projetoId}${tenantAtivo ? `?tenantId=${tenantAtivo}` : ""}`, { dados });

      setProjeto({
        id: projetoId,
        nome: nome || projeto?.nome || "Mapa",
        criadoEm: projeto?.criadoEm ?? Date.now(),
        dados,
      });
      setArrangement(r.arrangement);
      setVersaoSel(versao.numero);
      setMsg(`Versão ${versao.numero} gerada neste projeto. Novas versões não criam novos projetos.`);
      carregarProjetos();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao gerar o mapa.");
    } finally {
      setGerando(false);
    }
  }

  function trocar(seat: string) {
    if (!arrangement) return;
    if (trocando === null) {
      setTrocando(seat);
      return;
    }
    if (trocando === seat) {
      setTrocando(null);
      return;
    }
    const novo = arrangement.map((x) => {
      if (x.seat === trocando) return { ...x, seat };
      if (x.seat === seat) return { ...x, seat: trocando };
      return x;
    });
    setArrangement(novo);
    setTrocando(null);
  }

  const maxLinhas = Math.max(1, ...Object.values(carteirasPorColuna));

  return (
    <AppShell titulo="MapIA — Geração de Mapas de Sala" itens={itens}>
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="flex flex-col gap-4">
          <section className="rounded-md border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <h2 className="text-sm font-semibold text-slate-700">Projetos de mapa</h2>
              <button
                onClick={() => {
                  setProjeto(null);
                  setNome("");
                  setAlunos([]);
                  setGrupos([]);
                  setArrangement(null);
                  setVersaoSel(null);
                  setMarcas(MARCAS_VAZIAS());
                  setMsg("Novo projeto: configure os dados e gere o primeiro mapa.");
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Novo
              </button>
            </div>
            <div className="max-h-52 overflow-auto">
              {projetos.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">Nenhum projeto ainda.</p>
              ) : (
                projetos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => carregarProjeto(p)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      projeto?.id === p.id ? "bg-primary-50 text-primary-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate font-medium">{p.nome}</span>
                    <span className="text-xs text-slate-400">{p.dados?.versoes?.length ?? 0} vers.</span>
                  </button>
                ))
              )}
            </div>
            {projeto?.dados.versoes && projeto.dados.versoes.length > 0 && (
              <div className="border-t border-slate-100 px-3 py-2">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Versões</h3>
                <div className="flex flex-wrap gap-1">
                  {projeto.dados.versoes.map((v) => (
                    <button
                      key={v.numero}
                      onClick={() => {
                        setArrangement(v.arrangement);
                        setVersaoSel(v.numero);
                      }}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        versaoSel === v.numero ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      V{v.numero}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-md border border-slate-200 p-3">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Alunos ({alunos.length})</h2>
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
                placeholder="Nome do aluno"
                value={novoAluno}
                onChange={(e) => setNovoAluno(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarAluno()}
              />
              <button onClick={adicionarAluno} className="rounded-md bg-primary px-2.5 text-sm text-white" aria-label="Adicionar aluno">+</button>
            </div>
            <button onClick={importarDaGestao} className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Importar da Gestão de Alunos
            </button>
            <ul className="mt-2 max-h-44 flex flex-col gap-1.5 overflow-auto">
              {alunos.map((a, i) => (
                <li key={i} className="rounded-md border border-slate-100 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{a.name}</span>
                    <button onClick={() => setAlunos(alunos.filter((_, j) => j !== i))} className="text-red-600" aria-label="Remover aluno">✕</button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-0.5">
                    {FLAGS.map((f) => (
                      <label key={String(f.campo)} className="flex items-center gap-1 text-slate-600">
                        <input
                          type="checkbox"
                          checked={!!a[f.campo]}
                          onChange={(e) =>
                            setAlunos(alunos.map((x, j) => (j === i ? { ...x, [f.campo]: e.target.checked } : x)))
                          }
                        />
                        {f.rotulo}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-slate-100 pt-2">
              <label className="text-xs font-medium text-slate-500">Grupos de conversação (por nome, separados por vírgula)</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                  placeholder="ex.: Ana, Bruno"
                  value={novoGrupo}
                  onChange={(e) => setNovoGrupo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarGrupo()}
                />
                <button onClick={adicionarGrupo} className="rounded-md border border-slate-200 px-2 text-xs" aria-label="Adicionar grupo">+</button>
              </div>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-slate-600">
                {grupos.map((g, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                    <span>{g.membros.join(" ⇔ ")}</span>
                    <button onClick={() => setGrupos(grupos.filter((_, j) => j !== i))} className="text-red-600" aria-label="Remover grupo">✕</button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Nome do projeto (ex.: Mapa 9º A — 2026)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <button onClick={gerar} disabled={gerando} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60">
              {gerando ? "Gerando..." : arrangement ? "Gerar nova versão" : "Gerar mapa"}
            </button>
          </div>
          {msg && <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">{msg}</p>}

          <div className="rounded-md border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Configuração da sala</h2>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Layout</label>
                <div className="mt-1 flex gap-1">
                  {([
                    ["tradicional", "Tradicional"],
                    ["u", "Formato U"],
                    ["grupos", "Grupos"],
                    ["roda", "Roda"],
                  ] as [LayoutId, string][]).map(([id, rotulo]) => (
                    <button
                      key={id}
                      onClick={() => setLayout(id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                        layout === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              {layout === "grupos" && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Alunos por grupo</label>
                  <select
                    className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    value={tamanhoGrupo}
                    onChange={(e) => setTamanhoGrupo(Number(e.target.value))}
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
              {layout === "tradicional" && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Colunas ({cols})</label>
                  <input type="range" min={1} max={10} value={cols} onChange={(e) => setColunas(Number(e.target.value))} className="mt-2 w-32" />
                </div>
              )}
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-slate-500">
                  Sala gerada automaticamente a partir dos dados ({numeroAlunos} carteiras).
                </p>
                <PreviewSala layout={layout} colunas={cols} carteirasPorColuna={carteirasPorColuna} tamanhoGrupo={tamanhoGrupo} />
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">Referências da sala (opcional):</p>
                <div className="mb-2 flex gap-1">
                  {([
                    ["porta", "Porta"],
                    ["professor", "Professor"],
                    ["janela", "Janela"],
                    ["borracha", "Limpar"],
                  ] as [FerramentaPixel, string][]).map(([f, rotulo]) => (
                    <button
                      key={f}
                      onClick={() => setFerramenta(f)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${ferramenta === f ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <PixelGrid colunas={cols} carteirasPorColuna={carteirasPorColuna} marcas={marcas} setMarcas={setMarcas} ferramenta={ferramenta} />
              </div>
            </div>
          </div>

          {arrangement && (
            <div className="rounded-md border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  {versaoSel ? `Versão ${versaoSel} do mapa` : "Mapa gerado"}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const linhas = [["Carteira", "Aluno"], ...arrangement.map((a) => [a.seat, a.name])];
                      const csv = linhas.map((l) => l.join(";")).join("\n");
                      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `mapia-v${versaoSel ?? 1}.csv`;
                      a.click();
                    }}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Exportar CSV
                  </button>
                  <button onClick={() => window.print()} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                    Imprimir
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Clique em dois alunos para trocar de lugar
                {trocando ? ` (selecionado: ${arrangement.find((a) => a.seat === trocando)?.name ?? trocando})` : ""}.
              </p>
              <div className="mt-3 overflow-auto">
                <div className="inline-block rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 6.5rem)` }}>
                    {Array.from({ length: cols * maxLinhas }, (_, i) => {
                      const r = Math.floor(i / cols);
                      const c = i % cols;
                      const code = `${String.fromCharCode(65 + r)}${c + 1}`;
                      const existe = r < (carteirasPorColuna[c + 1] ?? 0);
                      const ocupante = arrangement.find((a) => a.seat === code);
                      return (
                        <button
                          key={code}
                          onClick={() => ocupante && trocar(code)}
                          disabled={!ocupante}
                          className={`flex min-h-9 items-center justify-center rounded border px-1 py-1 text-xs transition-colors ${
                            !existe
                              ? "border-dashed border-slate-200 bg-transparent"
                              : ocupante
                                ? trocando === code
                                  ? "border-primary bg-primary-50 font-semibold text-primary-700"
                                  : "border-primary-100 bg-white font-semibold text-slate-900"
                                : "border-slate-300 bg-white/60 text-slate-300"
                          }`}
                        >
                          {existe ? (ocupante ? ocupante.name : code) : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
