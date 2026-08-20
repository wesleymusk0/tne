"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Editor visual da sala MapIA — canvas com mesma escala do legado. */
export const CANVAS_LARGURA = 1376;
export const CANVAS_ALTURA = 860;
export const CORREDOR = 215;
export const DESK_R = 16;
export const ESCALA = 2; // 2px por cm

export type ModoEditor = "seats" | "move" | "door" | "prof" | "window" | "importance";

export interface DeskPos {
  x: number;
  y: number;
  col: number;
  priority: number; // 7|4|3|1 — importância da localização
}

const CORES_PRIORIDADE: Record<number, string> = {
  7: "#ff0000",
  4: "#ffff00",
  3: "#00ff00",
  1: "#ff00ff",
  0: "#cccccc",
};
export const ORDEM_PRIORIDADES = [7, 4, 3, 1];

function snap(v: number, grid = 5) {
  return Math.round(v / grid) * grid;
}

/** Layouts da TNE §13: tradicional, U, grupos (2–6), roda. */
export function gerarLayout(
  layout: "tradicional" | "u" | "grupos" | "roda",
  total: number,
  tamanhoGrupo = 4
): DeskPos[] {
  const posicoes: DeskPos[] = [];
  const xIni = CORREDOR + 60;
  const yIni = CORREDOR + 50;
  const xFim = CANVAS_LARGURA - 60;
  const yFim = CANVAS_ALTURA - 60;
  const larguraUtil = xFim - xIni;
  const alturaUtil = yFim - yIni;

  if (total <= 0) return posicoes;
  const push = (x: number, y: number) =>
    posicoes.push({ x: snap(Math.min(Math.max(x, CORREDOR + DESK_R), CANVAS_LARGURA - DESK_R)), y: snap(Math.min(Math.max(y, CORREDOR + DESK_R), CANVAS_ALTURA - DESK_R)), col: posicoes.length, priority: 0 });

  if (layout === "tradicional") {
    const colunas = Math.min(8, Math.ceil(Math.sqrt(total)));
    const porColuna = Math.ceil(total / colunas);
    const dx = colunas > 1 ? larguraUtil / (colunas - 1) : 0;
    const dy = porColuna > 1 ? alturaUtil / (porColuna - 1) : 0;
    for (let i = 0; i < total; i++) {
      const c = i % colunas;
      const r = Math.floor(i / colunas);
      push(xIni + c * dx, yIni + r * dy);
    }
  } else if (layout === "u") {
    const perimetro = 2 * larguraUtil + alturaUtil;
    for (let i = 0; i < total; i++) {
      const dist = (perimetro / (total + 1)) * (i + 1);
      if (dist <= alturaUtil) push(xIni, yIni + dist);
      else if (dist <= alturaUtil + larguraUtil) push(xIni + (dist - alturaUtil), yIni + alturaUtil);
      else push(xIni + larguraUtil, yIni + alturaUtil - (dist - alturaUtil - larguraUtil));
    }
  } else if (layout === "grupos") {
    const grupo = Math.max(2, Math.min(6, tamanhoGrupo));
    const nGrupos = Math.ceil(total / grupo);
    const cols = Math.ceil(Math.sqrt(nGrupos));
    const lins = Math.ceil(nGrupos / cols);
    for (let g = 0; g < nGrupos; g++) {
      const gx = xIni + ((larguraUtil / Math.max(1, cols)) / 2) + (larguraUtil / Math.max(1, cols)) * (g % cols);
      const gy = yIni + ((alturaUtil / Math.max(1, lins)) / 2) + (alturaUtil / Math.max(1, lins)) * Math.floor(g / cols);
      const raio = grupo <= 3 ? 42 : grupo === 4 ? 46 : 56;
      for (let k = 0; k < grupo && g * grupo + k < total; k++) {
        const ang = (2 * Math.PI * k) / grupo - Math.PI / 2;
        push(gx + raio * Math.cos(ang), gy + raio * Math.sin(ang));
      }
    }
  } else {
    // roda / círculo
    const cx = xIni + larguraUtil / 2;
    const cy = yIni + alturaUtil / 2;
    const raio = Math.min(larguraUtil, alturaUtil) / 2 - 30;
    for (let i = 0; i < total; i++) {
      const ang = (2 * Math.PI * i) / total - Math.PI / 2;
      push(cx + raio * Math.cos(ang), cy + raio * Math.sin(ang));
    }
  }
  return posicoes;
}

export function MapiaCanvas({
  desks,
  setDesks,
  modo,
  marcas,
  setMarcas,
}: {
  desks: DeskPos[];
  setDesks: (d: DeskPos[]) => void;
  modo: ModoEditor;
  marcas: { door: string[]; prof: string[]; window: string[] };
  setMarcas: (m: { door: string[]; prof: string[]; window: string[] }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);

  const desenhar = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_LARGURA, CANVAS_ALTURA);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_LARGURA, CANVAS_ALTURA);

    // corredores (área restrita)
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    ctx.fillRect(0, 0, CORREDOR, CANVAS_ALTURA);
    ctx.fillRect(0, 0, CANVAS_LARGURA, CORREDOR);
    ctx.strokeStyle = "#e2e8f0";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(CORREDOR, CORREDOR, CANVAS_LARGURA - CORREDOR, CANVAS_ALTURA - CORREDOR);
    ctx.setLineDash([]);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Arial";
    ctx.fillText("Corredor (manter livre)", 12, CORREDOR - 8);

    // carteiras
    desks.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, DESK_R, 0, 2 * Math.PI);
      ctx.fillStyle = d.priority ? CORES_PRIORIDADE[d.priority] : "#cbd5e1";
      if (d.priority === 4) ctx.fillStyle = CORES_PRIORIDADE[4];
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), d.x, d.y + 4);
    });

    // marcas de referência
    const desenharMarca = (lista: string[], cor: string, letra: string) => {
      ctx.fillStyle = cor;
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      for (const m of lista) {
        const [x, y] = m.split(",").map(Number);
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(letra, x, y + 5);
        ctx.fillStyle = cor;
      }
    };
    desenharMarca(marcas.door, "#16a34a", "P");
    desenharMarca(marcas.prof, "#0ea5e9", "T");
    desenharMarca(marcas.window, "#eab308", "J");
  }, [desks, marcas]);

  useEffect(desenhar, [desenhar]);

  function posicaoEvento(e: React.MouseEvent): [number, number] {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0];
    const sx = CANVAS_LARGURA / rect.width;
    const sy = CANVAS_ALTURA / rect.height;
    return [(e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy];
  }

  function deskEm(x: number, y: number): number | null {
    const idx = desks.findIndex((d) => Math.hypot(d.x - x, d.y - y) <= DESK_R + 4);
    return idx >= 0 ? idx : null;
  }

  function aoClicar(e: React.MouseEvent) {
    const [x, y] = posicaoEvento(e);
    const idx = deskEm(x, y);
    if (modo === "move") {
      setArrastando(idx);
      return;
    }
    if (modo === "importance" && idx !== null) {
      setDesks(desks.map((d, i) => {
        if (i !== idx) return d;
        const atual = d.priority;
        const prox = ORDEM_PRIORIDADES[(ORDEM_PRIORIDADES.indexOf(atual) + 1) % ORDEM_PRIORIDADES.length];
        return { ...d, priority: d.priority === 1 ? 0 : prox };
      }));
      return;
    }
    if (modo === "door" || modo === "prof" || modo === "window") {
      const chave = `${snap(x)},${snap(y)}`;
      setMarcas({
        ...marcas,
        [modo]: marcas[modo].includes(chave)
          ? marcas[modo].filter((m) => m !== chave)
          : [...marcas[modo], chave],
      });
      return;
    }
    // modo seats: adicionar/remover carteira
    if (idx !== null) {
      setDesks(desks.filter((_, i) => i !== idx));
    } else if (x > CORREDOR && y > CORREDOR) {
      setDesks([...desks, { x: snap(x), y: snap(y), col: desks.length, priority: 0 }]);
    }
  }

  function aoMover(e: React.MouseEvent) {
    if (modo !== "move" || arrastando === null) return;
    const [x, y] = posicaoEvento(e);
    setDesks(desks.map((d, i) =>
      i === arrastando
        ? { ...d, x: snap(Math.min(Math.max(x, CORREDOR + DESK_R), CANVAS_LARGURA - DESK_R)), y: snap(Math.min(Math.max(y, CORREDOR + DESK_R), CANVAS_ALTURA - DESK_R)) }
        : d
    ));
  }

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <canvas
        ref={canvasRef}
        width={CANVAS_LARGURA}
        height={CANVAS_ALTURA}
        className="max-w-none cursor-crosshair"
        onMouseDown={aoClicar}
        onMouseMove={aoMover}
        onMouseUp={() => setArrastando(null)}
        onMouseLeave={() => setArrastando(null)}
      />
    </div>
  );
}
