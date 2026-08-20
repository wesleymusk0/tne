"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMenuItens } from "@/lib/menu";
import { GabaritoTemplate, gerarSvgGabarito, imprimirGabarito } from "@/lib/somatoria-gabarito";
import { processarScan } from "@/lib/somatoria-scanner";
import { menuParaSistema } from "@/lib/menu";

type Aba = "modelos" | "correcao" | "scanner";

const OPCOES_PADRAO = [1, 2, 4, 8, 16, 32];

function baixarCsv(nome: string, linhas: string[][]) {
  const csv = linhas.map((l) => l.join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SomatoriaPage() {
  const { perfil, tenantAtivo } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const [aba, setAba] = useState<Aba>("modelos");
  const [template, setTemplate] = useState<GabaritoTemplate>({
    name: "Padrão", numQuestions: 40, defaultValue: 1, alternatives: [...OPCOES_PADRAO], answerMode: "digital",
  });
  const [msg, setMsg] = useState("");

  // correção manual
  const [gabarito, setGabarito] = useState("");
  const [respostas, setRespostas] = useState("");
  const [resultado, setResultado] = useState<{ notas: number[]; total: number } | null>(null);

  // scanner
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [captura, setCaptura] = useState<string | null>(null);
  const [scan, setScan] = useState<{ relatorio: string; total: number; imagemProcessada: string } | null>(null);
  const [numeroProva, setNumeroProva] = useState(1);

  useEffect(() => () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const corrigir = useCallback(async () => {
    setMsg("");
    try {
      const parse = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      const gab = parse(gabarito);
      const resp = parse(respostas);
      const r = await api.post<{ notas: number[]; total: number }>("/engines/somatoria/calcular", {
        tenantId: tenantAtivo ?? undefined,
        gabaritos: gab,
        respostas: resp,
        valores: gab.map(() => template.defaultValue),
      });
      setResultado(r);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro na correção.");
    }
  }, [gabarito, respostas, tenantAtivo, template.defaultValue]);

  async function iniciarCamera() {
    setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraAtiva(true);
      setCaptura(null);
      setScan(null);
    } catch {
      setMsg("Erro ao acessar a câmera. Verifique as permissões do navegador.");
    }
  }

  function pararCamera() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraAtiva(false);
  }

  function capturarFoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvasRef.current = canvas;
    setCaptura(canvas.toDataURL("image/jpeg", 0.8));
    pararCamera();
  }

  function processar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!gabarito.trim()) {
      setMsg("Insira o gabarito oficial (ex.: 09, 12, 31) antes de processar.");
      return;
    }
    setMsg("");
    const r = processarScan(canvas, template, gabarito, numeroProva);
    if ("erro" in r) {
      setMsg(r.erro);
      return;
    }
    setScan(r);
    setNumeroProva((n) => n + 1);
  }

  function imprimirRelatorio() {
    if (!scan) return;
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.write(
      `<html><head><title>Relatório #${numeroProva - 1}</title><style>body{font-family:monospace;padding:20px;font-size:13px;}pre{white-space:pre-wrap;}</style></head><body><button onclick="window.print()" style="padding:10px;margin-bottom:10px;">Imprimir</button><pre>${scan.relatorio}</pre></body></html>`
    );
    printWin.document.close();
  }

  const campo = "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <AppShell titulo="SomatorIA — Correção por Somatória" itens={itens}>
      <div className="mb-5 flex gap-1 border-b border-slate-100">
        {(
          [
            ["modelos", "Modelos de Gabarito"],
            ["correcao", "Correção Manual"],
            ["scanner", "Scanner Automático"],
          ] as [Aba, string][]
        ).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium ${aba === id ? "bg-blue-100 text-blue-800" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {msg && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</p>}

      {aba === "modelos" && (
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-md border border-slate-100 p-4">
            <label className="text-xs font-medium text-slate-500">Nome do modelo</label>
            <input className={campo} value={template.name} onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))} />
            <label className="text-xs font-medium text-slate-500">Número de questões</label>
            <input
              className={campo}
              inputMode="numeric"
              value={template.numQuestions}
              onChange={(e) => setTemplate((t) => ({ ...t, numQuestions: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
            />
            <label className="text-xs font-medium text-slate-500">Valor por questão</label>
            <input
              className={campo}
              inputMode="decimal"
              value={template.defaultValue}
              onChange={(e) => setTemplate((t) => ({ ...t, defaultValue: Number(e.target.value.replace(",", ".")) || 0 }))}
            />
            <label className="text-xs font-medium text-slate-500">Alternativas (somas)</label>
            <div className="flex flex-wrap gap-3">
              {OPCOES_PADRAO.map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={(template.alternatives ?? []).includes(v)}
                    onChange={(e) =>
                      setTemplate((t) => ({
                        ...t,
                        alternatives: e.target.checked
                          ? [...(t.alternatives ?? []), v].sort((a, b) => a - b)
                          : (t.alternatives ?? []).filter((x) => x !== v),
                      }))
                    }
                  />
                  {String(v).padStart(2, "0")}
                </label>
              ))}
            </div>
            <label className="text-xs font-medium text-slate-500">Modo de resposta</label>
            <select
              className={campo}
              value={template.answerMode}
              onChange={(e) => setTemplate((t) => ({ ...t, answerMode: e.target.value as "digital" | "manual" }))}
            >
              <option value="digital">Digital (soma das bolinhas)</option>
              <option value="manual">Manual (dígitos escritos)</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => imprimirGabarito(template)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
                Imprimir gabarito (A4)
              </button>
              <button
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (!win) return;
                  win.document.write(`<html><body><svg viewBox="0 0 210 297" style="max-width:100%;height:95vh;">${gerarSvgGabarito(template)}</svg></body></html>`);
                  win.document.close();
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Pré-visualizar
              </button>
            </div>
          </div>
          <div className="rounded-md border border-slate-100 p-4 text-sm text-slate-600">
            <h3 className="mb-2 font-medium text-slate-900">Como funciona</h3>
            <p>O aluno pinta as bolinhas das alternativas; a leitura é feita pela SOMA dos valores pintados.</p>
            <p className="mt-2">Acerto parcial: resposta contida no gabarito pontua proporcionalmente. Qualquer alternativa errada assinalada zera a questão.</p>
            <p className="mt-2">Imprima o gabarito, aplique a prova, digitalize com o Scanner Automático e receba a correção na hora.</p>
          </div>
        </div>
      )}

      {aba === "correcao" && (
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Gabarito oficial (somas separadas por vírgula)</label>
              <textarea className={campo} rows={3} placeholder="ex.: 09, 12, 31, 05..." value={gabarito} onChange={(e) => setGabarito(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Respostas do aluno</label>
              <textarea className={campo} rows={3} placeholder="ex.: 09, 04, 33, 00..." value={respostas} onChange={(e) => setRespostas(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={corrigir} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Corrigir
            </button>
            {resultado && (
              <button
                onClick={() =>
                  baixarCsv("somatoria-resultado.csv", [
                    ["Questão", "Nota"],
                    ...resultado.notas.map((n, i) => [String(i + 1), n.toFixed(1)]),
                    ["Total", resultado.total.toFixed(1)],
                  ])
                }
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Exportar CSV
              </button>
            )}
          </div>
          {resultado && (
            <div className="rounded-md border border-slate-100 p-4">
              <div className="mb-2 text-lg font-semibold text-slate-900">
                Nota final: {resultado.total.toFixed(1)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {resultado.notas.map((n, i) => (
                  <span key={i} className={`rounded px-2 py-1 text-xs font-medium ${n > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    Q{i + 1}: {n.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aba === "scanner" && (
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Gabarito oficial (somas separadas por vírgula)</label>
            <input className={campo} placeholder="ex.: 09, 12, 31" value={gabarito} onChange={(e) => setGabarito(e.target.value)} />
          </div>

          {!cameraAtiva && !captura && (
            <button onClick={iniciarCamera} className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Iniciar câmera
            </button>
          )}
          {cameraAtiva && (
            <div className="rounded-md border border-slate-100 p-3">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
              <button onClick={capturarFoto} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
                Capturar foto
              </button>
            </div>
          )}
          {captura && !cameraAtiva && (
            <div className="rounded-md border border-slate-100 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={scan?.imagemProcessada ?? captura} alt="Gabarito capturado" className="w-full rounded-lg border border-slate-200" />
              <div className="mt-3 flex gap-2">
                <button onClick={processar} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
                  {template.answerMode === "manual" ? "Reconhecer dígitos" : "Processar e Corrigir"}
                </button>
                <button onClick={iniciarCamera} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Refazer foto
                </button>
              </div>
            </div>
          )}
          {scan && (
            <div className="rounded-md border border-slate-100 p-4">
              <div className="mb-2 text-lg font-semibold text-slate-900">Nota final: {scan.total.toFixed(1)}</div>
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{scan.relatorio}</pre>
              <button onClick={imprimirRelatorio} className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Imprimir relatório
              </button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
