"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { DeskPos, gerarLayout, MapiaCanvas, ModoEditor } from "@/components/MapiaCanvas";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Aluno {
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

interface MapaResultado {
  seatMap: Record<string, string>;
  studentReports: Record<string, string>;
  classReports: string[];
}

const FLAGS: { campo: keyof Aluno; rotulo: string }[] = [
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

const MODOS: { id: ModoEditor; rotulo: string }[] = [
  { id: "seats", rotulo: "Carteiras" },
  { id: "move", rotulo: "Mover" },
  { id: "importance", rotulo: "Importância" },
  { id: "door", rotulo: "Porta" },
  { id: "prof", rotulo: "Professor" },
  { id: "window", rotulo: "Janela" },
];

export default function MapiaPage() {
  const { perfil, tenantAtivo } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [novoAluno, setNovoAluno] = useState("");
  const [desks, setDesks] = useState<DeskPos[]>([]);
  const [marcas, setMarcas] = useState({ door: [] as string[], prof: [] as string[], window: [] as string[] });
  const [modo, setModo] = useState<ModoEditor>("seats");
  const [layout, setLayout] = useState<"tradicional" | "u" | "grupos" | "roda">("tradicional");
  const [tamanhoGrupo, setTamanhoGrupo] = useState(4);
  const [resultado, setResultado] = useState<MapaResultado | null>(null);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState("");
  const [projetoId, setProjetoId] = useState<string | null>(null);

  const menuItens = [
    { href: "/dashboard", rotulo: "Dashboard", icone: "🏠" },
    { href: "/sistemas/mapia", rotulo: "MapIA", icone: "🗺️" },
  ];

  function importarDaGestao() {
    if (!tenantAtivo) {
      setMsg("Selecione uma instituição no Dashboard para importar alunos.");
      return;
    }
    api.get<{ alunos: Record<string, unknown>[] }>(`/academico/${tenantAtivo}/alunos`).then((r) => {
      const lista = r.alunos.map((a) => ({
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
      setMsg(`${lista.length} alunos importados da Gestão de Alunos.`);
    }).catch(() => setMsg("Falha ao importar alunos."));
  }

  function adicionarAluno() {
    const nome = novoAluno.trim();
    if (!nome) return;
    setAlunos((prev) => [...prev, { name: nome }]);
    setNovoAluno("");
  }

  function aplicarLayout() {
    setDesks(gerarLayout(layout, alunos.length, tamanhoGrupo));
    setMsg(`Layout "${layout}" aplicado com ${alunos.length} carteiras.`);
  }

  const gerar = useCallback(async () => {
    if (alunos.length === 0 || desks.length === 0) {
      setMsg("Adicione alunos e defina as carteiras antes de gerar.");
      return;
    }
    setGerando(true);
    setMsg("");
    try {
      const payload = {
        tenantId: tenantAtivo ?? undefined,
        projetoId: projetoId ?? undefined,
        students: alunos,
        columns: desks.length,
        deskPositions: desks.map((d) => ({ x: d.x, y: d.y, col: d.col, priority: d.priority })),
        doorPixelCells: marcas.door,
        profPixelCells: marcas.prof,
        windowPixelCells: marcas.window,
      };
      if (projetoId) {
        const r = await api.post<MapaResultado>("/engines/mapia/gerar", payload);
        setResultado(r);
      } else {
        const proj = await api.post<{ projetoId: string }>("/projetos/mapia", {
          tenantId: tenantAtivo ?? undefined,
          nome: `Mapa ${new Date().toLocaleDateString("pt-BR")}`,
          dados: payload,
        });
        setProjetoId(proj.projetoId);
        const r = await api.post<MapaResultado>("/engines/mapia/gerar", { ...payload, projetoId: proj.projetoId });
        setResultado(r);
      }
      setMsg("Mapa gerado. Você pode gerar outras versões dentro deste mesmo projeto sem consumir nova cota.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao gerar o mapa.");
    } finally {
      setGerando(false);
    }
  }, [alunos, desks, marcas, tenantAtivo, projetoId]);

  return (
    <AppShell titulo="MapIA — Mapas de Sala" itens={menuItens}>
      <div className="grid gap-6 xl:grid-cols-[300px,1fr]">
        <section className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Nome do aluno"
              value={novoAluno}
              onChange={(e) => setNovoAluno(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionarAluno()}
            />
            <button onClick={adicionarAluno} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">+</button>
          </div>
          <button onClick={importarDaGestao} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Importar da Gestão de Alunos
          </button>

          <ul className="max-h-[46vh] flex flex-col gap-1.5 overflow-auto">
            {alunos.map((a, i) => (
              <li key={i} className="rounded-lg border border-slate-100 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{a.name}</span>
                  <button onClick={() => setAlunos(alunos.filter((_, k) => k !== i))} className="text-xs text-red-600">✕</button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-0.5">
                  {FLAGS.map((f) => (
                    <label key={String(f.campo)} className="flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={!!a[f.campo]}
                        onChange={(e) =>
                          setAlunos(alunos.map((x, k) => (k === i ? { ...x, [f.campo]: e.target.checked } : x)))
                        }
                      />
                      {f.rotulo}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-slate-100 p-3">
            <label className="text-xs font-medium text-slate-500">Layout da sala</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(["tradicional", "u", "grupos", "roda"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium ${layout === l ? "bg-blue-100 text-blue-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  {l === "u" ? "Formato U" : l === "grupos" ? "Grupos" : l === "roda" ? "Roda/Círculo" : "Tradicional"}
                </button>
              ))}
            </div>
            {layout === "grupos" && (
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                value={tamanhoGrupo}
                onChange={(e) => setTamanhoGrupo(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>Grupos de {n} alunos</option>
                ))}
              </select>
            )}
            <button onClick={aplicarLayout} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Aplicar layout ({alunos.length} carteiras)
            </button>
          </div>

          <button
            onClick={gerar}
            disabled={gerando}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {gerando ? "Gerando..." : resultado ? "Gerar nova versão" : "Gerar mapa"}
          </button>
          {msg && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{msg}</p>}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {MODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModo(m.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${modo === m.id ? "bg-blue-100 text-blue-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
              >
                {m.rotulo}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400">
              {desks.length} carteiras · Clique para {modo === "importance" ? "definir importância" : modo === "move" ? "arrastar" : "adicionar/remover"}
            </span>
          </div>
          <MapiaCanvas desks={desks} setDesks={setDesks} modo={modo} marcas={marcas} setMarcas={setMarcas} />

          {resultado && (
            <div className="rounded-xl border border-slate-100 p-4">
              <h3 className="mb-2 font-medium text-slate-900">Posicionamento</h3>
              <div className="flex flex-wrap gap-1.5 text-sm">
                {Object.entries(resultado.seatMap).map(([desk, nome]) => (
                  <span key={desk} className="rounded bg-slate-50 px-2 py-1">
                    <strong>#{desk}</strong> {nome}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const linhas = [["Carteira", "Aluno"], ...Object.entries(resultado.seatMap).map(([d, n]) => [d, n])];
                    const csv = linhas.map((l) => l.join(";")).join("\n");
                    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "mapia-mapa.csv";
                    a.click();
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Exportar CSV
                </button>
                <button onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                  Imprimir
                </button>
              </div>
              <h3 className="mt-4 font-medium text-slate-900">Relatório da turma</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                {resultado.classReports.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <h3 className="mt-4 font-medium text-slate-900">Prioridades atendidas</h3>
              <ul className="mt-1 text-sm text-slate-600">
                {Object.entries(resultado.studentReports).map(([nome, rel]) => (
                  <li key={nome}>
                    <strong>{nome}:</strong> {rel}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
