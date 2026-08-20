/**
 * SomatorIA — Scanner Automático "Warp Hunter v7.0".
 * Port 1:1 do legado (somatoria/index.html processScanImage):
 * âncoras magenta → warp bilinear → leitura por luma/snap → notas por soma.
 */
import { GabaritoTemplate } from "./somatoria-gabarito";

export interface ResultadoScan {
  respostas: number[];
  notas: number[];
  total: number;
  relatorio: string;
  imagemProcessada: string;
}

export function processarScan(
  canvas: HTMLCanvasElement,
  template: GabaritoTemplate,
  gabaritoOficial: string,
  numeroProva: number
): ResultadoScan | { erro: string } {
  const isManualMode = template.answerMode === "manual";
  const officialAnswers = gabaritoOficial
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
  if (officialAnswers.length !== template.numQuestions) {
    return {
      erro: `O gabarito oficial deve ter exatamente ${template.numQuestions} respostas numéricas. Lidas: ${officialAnswers.length}.`,
    };
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return { erro: "Canvas indisponível." };
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const getMagentaScore = (x: number, y: number): number => {
    const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
    if (idx < 0 || idx >= data.length) return 0;
    return Math.max(0, data[idx] + data[idx + 2] - data[idx + 1] * 2);
  };
  const getLuma = (x: number, y: number): number => {
    const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
    if (idx < 0 || idx >= data.length) return 255;
    return data[idx] * 0.29 + data[idx + 1] * 0.58 + data[idx + 2] * 0.11;
  };
  const findAnchor = (minX: number, minY: number, maxX: number, maxY: number) => {
    let bS = -1;
    let bP = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    for (let y = minY + 10; y < maxY - 10; y += 15) {
      for (let x = minX + 10; x < maxX - 10; x += 15) {
        const s = getMagentaScore(x, y);
        if (s > bS) {
          bS = s;
          bP = { x, y };
        }
      }
    }
    return bP;
  };

  const pTL = findAnchor(0, 0, width * 0.4, height * 0.4);
  const pTR = findAnchor(width * 0.6, 0, width, height * 0.4);
  const pBL = findAnchor(0, height * 0.6, width * 0.4, height);
  const pBR = findAnchor(width * 0.6, height * 0.6, width, height);

  const warpW = 800;
  const warpH = 1100;
  const warpCanvas = document.createElement("canvas");
  warpCanvas.width = warpW;
  warpCanvas.height = warpH;
  const wCtx = warpCanvas.getContext("2d");
  if (!wCtx) return { erro: "Canvas indisponível." };
  const wData = wCtx.createImageData(warpW, warpH);

  for (let y = 0; y < warpH; y++) {
    const v = y / (warpH - 1);
    for (let x = 0; x < warpW; x++) {
      const u = x / (warpW - 1);
      const tx1 = pTL.x + u * (pTR.x - pTL.x);
      const ty1 = pTL.y + u * (pTR.y - pTL.y);
      const tx2 = pBL.x + u * (pBR.x - pBL.x);
      const ty2 = pBL.y + u * (pBR.y - pBL.y);
      const px = tx1 + v * (tx2 - tx1);
      const py = ty1 + v * (ty2 - ty1);
      const lum = getLuma(px, py);
      const idx = (y * warpW + x) * 4;
      wData.data[idx] = wData.data[idx + 1] = wData.data[idx + 2] = lum;
      wData.data[idx + 3] = 255;
    }
  }
  wCtx.putImageData(wData, 0, 0);

  const getWarpLuma = (wx: number, wy: number): number => {
    const idx = (Math.floor(wy) * warpW + Math.floor(wx)) * 4;
    if (idx < 0 || idx >= wData.data.length) return 255;
    return wData.data[idx];
  };
  const snapToSquare = (wx: number, wy: number, radius: number) => {
    let sX = 0;
    let sY = 0;
    let count = 0;
    const thresh = 130;
    for (let dy = -radius; dy <= radius; dy += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        if (getWarpLuma(wx + dx, wy + dy) < thresh) {
          sX += wx + dx;
          sY += wy + dy;
          count++;
        }
      }
    }
    if (count > 5) return { x: sX / count, y: sY / count };
    return { x: wx, y: wy };
  };

  const N = template.numQuestions;
  const optionsList =
    template.alternatives && template.alternatives.length > 0
      ? [...template.alternatives].sort((a, b) => a - b)
      : [1, 2, 4, 8, 16, 32];
  const numOpts = optionsList.length;
  const numCols = N > 20 ? 2 : 1;
  const rows = Math.ceil(N / numCols);
  const studentResponses = Array<number>(N).fill(0);

  ctx.clearRect(0, 0, width, height);
  const anchorTL_x = 14;
  const anchorTL_y = 14;
  const boxW = 182;
  const boxH = 269;

  if (isManualMode) {
    const maxSum_s = optionsList.reduce((a, b) => a + b, 0);
    const maxTens_s = maxSum_s <= 31 ? 3 : maxSum_s <= 63 ? 6 : 9;
    const isDense = N > 40;
    const NUM_COLS_M = isDense ? Math.ceil(N / 5) : 10;
    const DIG_GAP_S = isDense ? 4.1 : 5.0;
    const QCOL_W_S = isDense ? 190 / NUM_COLS_M : 19;
    const Q_START_X_S = 10;
    const Q_START_Y_S = 62;
    const DCOL_GAP_S = isDense ? 4.5 : 5.5;
    const Q_SEP_S = 5;
    const Q_PER_COL_S = Math.ceil(N / NUM_COLS_M);
    const xD_offset_s = isDense ? 6 : 7;
    const blockH_s = 10 * DIG_GAP_S + Q_SEP_S;

    const getLocalThresh = (wx: number, wy: number) => {
      let maxLuma = 0;
      for (let dy = -12; dy <= 12; dy += 4) {
        for (let dx = -12; dx <= 12; dx += 4) {
          const l = getWarpLuma(wx + dx, wy + dy);
          if (l > maxLuma) maxLuma = l;
        }
      }
      return maxLuma * 0.45;
    };
    const measureDigitInk = (px: number, py: number) => {
      let ink = 0;
      const lt = getLocalThresh(px, py);
      for (let dy = -7; dy <= 7; dy += 2) {
        for (let dx = -7; dx <= 7; dx += 2) {
          if (getWarpLuma(px + dx, py + dy) < lt) ink++;
        }
      }
      return ink;
    };
    const snapToInk = (wx: number, wy: number) => {
      let bS = -1;
      let bP = { x: wx, y: wy };
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const s = measureDigitInk(wx + dx, wy + dy);
          if (s > bS) {
            bS = s;
            bP = { x: wx + dx, y: wy + dy };
          }
        }
      }
      return bP;
    };
    const svgToWarp = (svgX: number, svgY: number) => ({
      wx: ((svgX - anchorTL_x) / boxW) * (warpW - 1),
      wy: ((svgY - anchorTL_y) / boxH) * (warpH - 1),
    });
    const warpToOrig = (wx: number, wy: number) => {
      const ru = wx / (warpW - 1);
      const rv = wy / (warpH - 1);
      const tx1 = pTL.x + ru * (pTR.x - pTL.x);
      const ty1 = pTL.y + ru * (pTR.y - pTL.y);
      const tx2 = pBL.x + ru * (pBR.x - pBL.x);
      const ty2 = pBL.y + ru * (pBR.y - pBL.y);
      return { x: tx1 + rv * (tx2 - tx1), y: ty1 + rv * (ty2 - ty1) };
    };

    for (let i = 0; i < N; i++) {
      const qi = Math.floor(i / NUM_COLS_M);
      const c_q = i % NUM_COLS_M;
      const qXBase_s = Q_START_X_S + c_q * QCOL_W_S;
      const xD_s = qXBase_s + xD_offset_s;
      const xU_s = xD_s + DCOL_GAP_S;
      let tensDigit = 0;
      let unitsDigit = 0;
      let maxTensInk = 20;
      let maxUnitsInk = 20;
      for (let d = 0; d <= 9; d++) {
        const dy_s = Q_START_Y_S + qi * blockH_s + d * DIG_GAP_S;
        const { wx: wxU_raw, wy: wyU_raw } = svgToWarp(xU_s, dy_s);
        const physU = snapToInk(wxU_raw, wyU_raw);
        const inkU = measureDigitInk(physU.x, physU.y);
        if (inkU > maxUnitsInk) {
          maxUnitsInk = inkU;
          unitsDigit = d;
        }
      }
      for (let d = 0; d <= maxTens_s; d++) {
        const dy_s = Q_START_Y_S + qi * blockH_s + d * DIG_GAP_S;
        const { wx: wxD_raw, wy: wyD_raw } = svgToWarp(xD_s, dy_s);
        const physD = snapToInk(wxD_raw, wyD_raw);
        const inkT = measureDigitInk(physD.x, physD.y);
        if (inkT > maxTensInk) {
          maxTensInk = inkT;
          tensDigit = d;
        }
      }
      const tensMarked = maxTensInk > 20;
      const unitsMarked = maxUnitsInk > 20;
      if (tensMarked || unitsMarked) studentResponses[i] = tensDigit * 10 + unitsDigit;
      else studentResponses[i] = 0;
      ctx.fillStyle = "rgba(255,204,0,0.70)";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      if (tensMarked) {
        const tensY_s = Q_START_Y_S + qi * blockH_s + tensDigit * DIG_GAP_S;
        const { wx, wy } = svgToWarp(xD_s, tensY_s);
        const snapped = snapToInk(wx, wy);
        const pT = warpToOrig(snapped.x, snapped.y);
        ctx.beginPath();
        ctx.arc(pT.x, pT.y, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.fillText(String(tensDigit), pT.x, pT.y + 4);
        ctx.fillStyle = "rgba(255,204,0,0.70)";
      }
      if (unitsMarked) {
        const unitsY_s = Q_START_Y_S + qi * blockH_s + unitsDigit * DIG_GAP_S;
        const { wx, wy } = svgToWarp(xU_s, unitsY_s);
        const snapped = snapToInk(wx, wy);
        const pU = warpToOrig(snapped.x, snapped.y);
        ctx.beginPath();
        ctx.arc(pU.x, pU.y, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.fillText(String(unitsDigit), pU.x, pU.y + 4);
        ctx.fillStyle = "rgba(255,204,0,0.70)";
      }
    }
  } else {
    for (let i = 0; i < N; i++) {
      const qi = Math.floor(i / numCols);
      const ci = i % numCols;
      const cy = rows > 1 ? 65 + qi * (210 / (rows - 1 || 1)) : 65;
      const v = (cy - anchorTL_y) / boxH;
      const xOffset = ci === 1 ? 125 : 30;
      for (let j = 0; j < numOpts; j++) {
        const cx = xOffset + j * (numOpts > 1 ? 55 / (numOpts - 1) : 0);
        const u = (cx - anchorTL_x) / boxW;
        const wx = u * (warpW - 1);
        const wy = v * (warpH - 1);
        const physical = snapToSquare(wx, wy, 15);
        const ru = physical.x / (warpW - 1);
        const rv = physical.y / (warpH - 1);
        const tx1 = pTL.x + ru * (pTR.x - pTL.x);
        const ty1 = pTL.y + ru * (pTR.y - pTL.y);
        const tx2 = pBL.x + ru * (pBR.x - pBL.x);
        const ty2 = pBL.y + ru * (pBR.y - pBL.y);
        const finalX = tx1 + rv * (tx2 - tx1);
        const finalY = ty1 + rv * (ty2 - ty1);
        let ink = 0;
        let localWhite = 0;
        for (let k = 0; k < 4; k++) {
          localWhite += getWarpLuma(
            physical.x + (k % 2 ? 30 : -30),
            physical.y + (k < 2 ? 30 : -30)
          );
        }
        const localThresh = (localWhite / 4) * 0.48;
        for (let dy = -8; dy <= 8; dy += 2) {
          for (let dx = -8; dx <= 8; dx += 2) {
            if (getWarpLuma(physical.x + dx, physical.y + dy) < localThresh) ink++;
          }
        }
        const isMarked = ink > 30;
        if (isMarked) studentResponses[i] += optionsList[j];
        ctx.strokeStyle = isMarked ? "#ffcc00" : "#ef4444";
        ctx.lineWidth = isMarked ? 3 : 1;
        ctx.beginPath();
        ctx.arc(finalX, finalY, 10, 0, 2 * Math.PI);
        ctx.stroke();
        if (isMarked) {
          ctx.fillStyle = "#ffcc00";
          ctx.fill();
        }
      }
    }
  }
  ctx.fillStyle = "#ff00ff";
  [pTL, pTR, pBL, pBR].forEach((p) => ctx.fillRect(p.x - 15, p.y - 15, 30, 30));

  // Notas por soma binária (mesma matemática do engine/backend).
  let totalScore = 0;
  const valQuestao = template.defaultValue;
  const notas: number[] = [];
  const scanLabel = isManualMode ? "Scan Dígitos" : "Scan Digital";
  let reportText = `Relatório SomatorIA - ${scanLabel} (Prova #${numeroProva})\n`;
  reportText += `Data: ${new Date().toLocaleString("pt-BR")}\n\n`;
  reportText += "======================================================\n";
  reportText += "| Questão | Oficial | Lida (Soma) | Nota Ponderada |\n";
  reportText += "|---------|---------|-------------|----------------|\n";
  for (let i = 0; i < N; i++) {
    const B = officialAnswers[i];
    const D = studentResponses[i];
    let questionScore = 0;
    if (B === 0 || isNaN(B)) questionScore = 0;
    else if (D === B) questionScore = valQuestao;
    else if ((D & B) === D && D > 0) {
      const bitsG = (B.toString(2).match(/1/g) || []).length;
      const bitsR = (D.toString(2).match(/1/g) || []).length;
      questionScore = (bitsR / bitsG) * valQuestao;
    } else questionScore = 0;
    questionScore = Math.round(questionScore * 10) / 10;
    totalScore += questionScore;
    notas.push(questionScore);
    reportText += `| ${String(i + 1).padEnd(7)} | ${String(B).padEnd(7)} | ${String(D).padEnd(11)} | ${questionScore.toFixed(1).padEnd(14)} |\n`;
  }
  reportText += "======================================================\n";
  reportText += `NOTA FINAL: ${totalScore.toFixed(1)} / ${(N * valQuestao).toFixed(1)}\n`;

  return {
    respostas: studentResponses,
    notas,
    total: Math.round(totalScore * 10) / 10,
    relatorio: reportText,
    imagemProcessada: canvas.toDataURL("image/jpeg", 0.8),
  };
}
