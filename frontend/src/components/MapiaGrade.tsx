"use client";

/** MapIA — grade de referências (porta/janela/professor) no espírito do legado:
 * as marcas ficam sobre as células da grade de carteiras (r,c), não sobre um canvas livre. */

export type FerramentaPixel = "porta" | "professor" | "janela" | "borracha";

export interface MarcasGrade {
  door: Set<string>;
  prof: Set<string>;
  window: Set<string>;
}

export const MARCAS_VAZIAS: () => MarcasGrade = () => ({
  door: new Set(),
  prof: new Set(),
  window: new Set(),
});

const ESTILOS: Record<string, { bg: string; texto: string; rotulo: string }> = {
  door: { bg: "bg-emerald-500", texto: "P", rotulo: "Porta" },
  prof: { bg: "bg-sky-500", texto: "T", rotulo: "Professor" },
  window: { bg: "bg-amber-400", texto: "J", rotulo: "Janela" },
};

export function PixelGrid({
  colunas,
  carteirasPorColuna,
  marcas,
  setMarcas,
  ferramenta,
}: {
  colunas: number;
  carteirasPorColuna: Record<number, number>;
  marcas: MarcasGrade;
  setMarcas: (m: MarcasGrade) => void;
  ferramenta: FerramentaPixel;
}) {
  const maxLinhas = Math.max(1, ...Object.values(carteirasPorColuna));

  function alternar(r: number, c: number) {
    const key = `${r},${c}`;
    const novo: MarcasGrade = {
      door: new Set(marcas.door),
      prof: new Set(marcas.prof),
      window: new Set(marcas.window),
    };
    if (ferramenta === "borracha") {
      novo.door.delete(key);
      novo.prof.delete(key);
      novo.window.delete(key);
    } else {
      const grupo = ferramenta === "porta" ? "door" : ferramenta === "professor" ? "prof" : "window";
      if (novo[grupo].has(key)) novo[grupo].delete(key);
      else {
        novo.door.delete(key);
        novo.prof.delete(key);
        novo.window.delete(key);
        novo[grupo].add(key);
      }
    }
    setMarcas(novo);
  }

  return (
    <div className="inline-block rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colunas}, 2.25rem)` }}>
        {Array.from({ length: maxLinhas * colunas }, (_, i) => {
          const r = Math.floor(i / colunas);
          const c = i % colunas;
          const existeCarteira = r < (carteirasPorColuna[c + 1] ?? 0);
          const key = `${r},${c}`;
          let marca: string | null = null;
          if (marcas.door.has(key)) marca = "door";
          else if (marcas.prof.has(key)) marca = "prof";
          else if (marcas.window.has(key)) marca = "window";
          return (
            <button
              key={key}
              type="button"
              onClick={() => alternar(r, c)}
              title={marca ? `${ESTILOS[marca].rotulo} (clique para alterar)` : `Célula ${r + 1},${c + 1}`}
              className={`flex h-9 items-center justify-center rounded border text-xs font-semibold transition-colors ${
                marca
                  ? `${ESTILOS[marca].bg} border-transparent text-white`
                  : existeCarteira
                    ? "border-slate-300 bg-white text-slate-500 hover:border-primary"
                    : "border-dashed border-slate-200 bg-transparent text-transparent"
              }`}
            >
              {marca ? ESTILOS[marca].texto : existeCarteira ? "" : ""}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-500" /> Porta
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-sky-500" /> Professor
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-400" /> Janela
        </span>
      </div>
    </div>
  );
}

/** Pré-visualização da sala gerada automaticamente (resultado, não desenho manual). */
export function PreviewSala({
  layout,
  colunas,
  carteirasPorColuna,
  tamanhoGrupo,
}: {
  layout: "tradicional" | "u" | "grupos" | "roda";
  colunas: number;
  carteirasPorColuna: Record<number, number>;
  tamanhoGrupo?: number;
}) {
  const posicoes: { x: number; y: number; rotulo: string }[] = [];
  let indice = 0;
  const listar = (xs: { x: number; y: number }[]) => {
    for (const p of xs) {
      posicoes.push({ ...p, rotulo: String(indice + 1) });
      indice++;
    }
  };

  if (layout === "roda") {
    const total = Object.values(carteirasPorColuna).reduce((a, b) => a + b, 0);
    const cx = 160;
    const cy = 110;
    const raio = 86;
    listar(
      Array.from({ length: total }, (_, i) => {
        const ang = (2 * Math.PI * i) / Math.max(1, total) - Math.PI / 2;
        return { x: cx + raio * Math.cos(ang), y: cy + raio * Math.sin(ang) };
      })
    );
  } else if (layout === "grupos") {
    const grupo = Math.max(2, Math.min(6, tamanhoGrupo ?? 4));
    const linhas = Math.max(...Object.values(carteirasPorColuna));
    const total = Object.values(carteirasPorColuna).reduce((a, b) => a + b, 0);
    let k = 0;
    outer: for (let l = 0; l < linhas; l++) {
      for (let g = 0; g < colunas; g++) {
        if (k >= total) break outer;
        const cx = 60 + g * 110;
        const cy = 45 + l * 130;
        const raio = grupo <= 3 ? 22 : grupo === 4 ? 24 : 30;
        for (let j = 0; j < grupo && k < total; j++) {
          const ang = (2 * Math.PI * j) / grupo - Math.PI / 2;
          listar([{ x: cx + raio * Math.cos(ang), y: cy + raio * Math.sin(ang) }]);
          k++;
        }
      }
    }
  } else if (layout === "u") {
    const total = Object.values(carteirasPorColuna).reduce((a, b) => a + b, 0);
    const braco = 200; // braço vertical
    const base = 250; // braço horizontal
    const perimetro = 2 * braco + base;
    const passo = perimetro / Math.max(1, total + 1);
    for (let i = 0; i < total; i++) {
      const dist = passo * (i + 1);
      if (dist <= braco) listar([{ x: 40, y: 25 + dist }]);
      else if (dist <= braco + base) listar([{ x: 40 + (dist - braco), y: 25 + braco }]);
      else listar([{ x: 40 + base, y: 25 + braco - (dist - braco - base) }]);
    }
  } else {
    const linhas = Math.max(...Object.values(carteirasPorColuna));
    for (let c = 0; c < colunas; c++) {
      for (let r = 0; r < (carteirasPorColuna[c + 1] ?? 0); r++) {
        listar([{ x: 35 + c * (290 / Math.max(1, colunas - 1)), y: 30 + r * (180 / Math.max(1, linhas - 1)) }]);
      }
    }
  }

  return (
    <svg viewBox="0 0 330 230" className="w-full rounded-md border border-slate-200 bg-white">
      {layout === "u" && (
        <path d="M40 25 v200 h250 v-200" fill="none" stroke="#cbd5e1" strokeDasharray="4 3" />
      )}
      {posicoes.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={11} fill="#eef4fc" stroke="#1d4ed8" strokeWidth={1} />
          <text x={p.x} y={p.y + 4} fontSize={9} textAnchor="middle" fill="#1d4ed8" fontFamily="Arial">
            {p.rotulo}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Resultado do mapa com troca por clique (legado usava drag). */
export function ResultadoGrade({
  colunas,
  carteirasPorColuna,
  arrangement,
  onSwap,
}: {
  colunas: number;
  carteirasPorColuna: Record<number, number>;
  arrangement: { name: string; seat: string }[];
  onSwap?: (seatA: string, seatB: string) => void;
}) {
  const linhas = Math.max(1, ...Object.values(carteirasPorColuna));
  const mapa = Object.fromEntries(arrangement.map((a) => [a.seat, a.name]));

  return (
    <div className="inline-block rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(5.5rem, 1fr))` }}>
        {Array.from({ length: linhas * colunas }, (_, i) => {
          const r = Math.floor(i / colunas);
          const c = i % colunas;
          const code = `${String.fromCharCode(65 + r)}${c + 1}`;
          const existe = r < (carteirasPorColuna[c + 1] ?? 0);
          const ocupado = mapa[code];
          return (
            <button
              key={code}
              type="button"
              disabled={!ocupado || !onSwap}
              onClick={() => onSwap?.(code, code)}
              data-seat={code}
              className={`flex min-h-9 items-center justify-center rounded border px-1 py-1 text-xs transition-colors ${
                !existe
                  ? "border-dashed border-slate-200 bg-transparent"
                  : ocupado
                    ? "border-primary-100 bg-white font-semibold text-slate-900"
                    : "border-slate-300 bg-white/60 text-slate-300"
              }`}
            >
              {existe ? (ocupado ? ocupado : `${code}`) : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
