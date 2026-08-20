/**
 * SomatorIA — geração do gabarito SVG para impressão (A4).
 * Port 1:1 do legado (somatoria/index.html printSelectedTemplate).
 */

export interface GabaritoTemplate {
  name: string;
  numQuestions: number;
  defaultValue: number;
  alternatives?: number[];
  answerMode?: "digital" | "manual";
  logoBase64?: string;
}

export function gerarSvgGabarito(template: GabaritoTemplate): string {
  const N = template.numQuestions;
  const options =
    template.alternatives && template.alternatives.length > 0
      ? [...template.alternatives].sort((a, b) => a - b)
      : [1, 2, 4, 8, 16, 32];
  const numOpts = options.length;
  const numCols = N > 20 ? 2 : 1;
  const rows = Math.ceil(N / numCols);
  const isManualMode = template.answerMode === "manual";

  let svg =
    `<rect x="10" y="10" width="10" height="10" fill="#ff00ff" rx="1" />` +
    `<rect x="190" y="10" width="10" height="10" fill="#ff00ff" rx="1" />` +
    `<rect x="10" y="277" width="10" height="10" fill="#ff00ff" rx="1" />` +
    `<rect x="190" y="277" width="10" height="10" fill="#ff00ff" rx="1" />`;

  const subtitle = isManualMode
    ? "Some os valores e escreva o resultado."
    : "Pinte completamente as bolinhas. O sistema lê a SOMA.";
  const titleY = 28;
  if (template.logoBase64) {
    svg += `<image href="${template.logoBase64}" x="85" y="7" width="40" preserveAspectRatio="xMaxYMin meet" />`;
  }
  svg +=
    `<text x="105" y="${titleY}" font-family="Arial" font-size="8" font-weight="bold" text-anchor="middle" fill="#000">${template.name.toUpperCase()}</text>` +
    `<text x="105" y="38" font-family="Arial" font-size="4.5" text-anchor="middle" fill="#000">Aluno(a): _________________________________________________ Turma: _______</text>` +
    `<text x="105" y="46" font-family="Arial" font-size="3.5" font-style="italic" text-anchor="middle" fill="#333">${subtitle}</text>` +
    `<line x1="10" y1="52" x2="200" y2="52" stroke="#000" stroke-width="0.5" />`;

  if (!isManualMode) {
    for (let i = 0; i < N; i++) {
      const qi = Math.floor(i / numCols);
      const ci = i % numCols;
      const cy = rows > 1 ? 65 + qi * (210 / (rows - 1 || 1)) : 65;
      const xOff = ci === 1 ? 125 : 30;
      svg += `<text x="${xOff - 8}" y="${cy + 1.5}" font-family="Arial" font-size="4.5" font-weight="bold" text-anchor="end" fill="#000">${String(i + 1).padStart(2, "0")}</text>`;
      for (let j = 0; j < numOpts; j++) {
        const cx = xOff + j * (numOpts > 1 ? 55 / (numOpts - 1) : 0);
        svg +=
          `<circle cx="${cx}" cy="${cy}" r="3.5" stroke="#000" stroke-width="0.5" fill="none" />` +
          `<text x="${cx}" cy="${cy + 1.2}" font-family="Arial" font-size="3.2" font-weight="bold" text-anchor="middle" fill="#000">${String(options[j]).padStart(2, "0")}</text>`;
      }
    }
  } else {
    const maxTens = options.reduce((a, b) => a + b, 0) <= 31 ? 3 : 6;
    const NUM_COLS_M = N > 40 ? Math.ceil(N / 5) : 10;
    const Q_PER_COL = Math.ceil(N / NUM_COLS_M);
    const DIG_R = N > 40 ? 1.7 : 2.0;
    const DIG_GAP = N > 40 ? 4.1 : 5.0;
    const DCOL_GAP = N > 40 ? 4.5 : 5.5;
    const QCOL_W = N > 40 ? 190 / NUM_COLS_M : 19;
    const xD_off = N > 40 ? 6 : 7;
    for (let qi = 0; qi < Q_PER_COL; qi++) {
      for (let c = 0; c < NUM_COLS_M; c++) {
        const qNum = qi * NUM_COLS_M + c + 1;
        if (qNum > N) break;
        const xD = 10 + c * QCOL_W + xD_off;
        const xU = xD + DCOL_GAP;
        const qY = 62 + qi * (10 * DIG_GAP + 5) - 3.2;
        svg += `<text x="${(xD + xU) / 2}" y="${qY}" font-family="Arial" font-size="${N > 40 ? 2.8 : 3.2}" font-weight="bold" text-anchor="middle" fill="#000">${String(qNum).padStart(2, "0")}</text>`;
        for (let d = 0; d <= 9; d++) {
          const dy = 62 + qi * (10 * DIG_GAP + 5) + d * DIG_GAP;
          if (d <= maxTens) {
            svg += `<circle cx="${xD}" cy="${dy}" r="${DIG_R}" stroke="#999" stroke-width="0.35" fill="none" /><text x="${xD}" y="${dy + DIG_R * 0.45}" font-family="Arial" font-size="${N > 40 ? 1.9 : 2.3}" text-anchor="middle" fill="#ccc">${d}</text>`;
          }
          svg += `<circle cx="${xU}" cy="${dy}" r="${DIG_R}" stroke="#999" stroke-width="0.35" fill="none" /><text x="${xU}" y="${dy + DIG_R * 0.45}" font-family="Arial" font-size="${N > 40 ? 1.9 : 2.3}" text-anchor="middle" fill="#ccc">${d}</text>`;
        }
      }
    }
  }
  svg += `<text x="105" y="292" font-family="Arial" font-size="3" text-anchor="middle" fill="#555">Gerado por <tspan fill="#4CAF50" font-weight="bold">SomatorIA</tspan> | <tspan fill="#001B4A" font-weight="bold">Systematrix</tspan></text>`;
  return svg;
}

export function imprimirGabarito(template: GabaritoTemplate): void {
  const printWin = window.open("", "_blank");
  if (!printWin) return;
  const svg = gerarSvgGabarito(template);
  printWin.document.write(
    `<html><head><style>@media print{@page{size:A4 portrait;margin:0;}svg{width:210mm;height:297mm;}}svg{max-width:210mm;max-height:297mm;}</style></head><body><svg viewBox="0 0 210 297">${svg}</svg><script>setTimeout(()=>window.print(),500);<\/script></body></html>`
  );
  printWin.document.close();
}
