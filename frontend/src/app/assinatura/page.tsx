"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell, ConfirmarAcao } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMenuItens } from "@/lib/menu";

const PLANOS = [
  {
    id: "free",
    nome: "FREE",
    preco: "R$ 0",
    sistemas: ["MapIA", "ProvIA", "AvalIA", "SomatorIA", "Simulador TRI", "BuscIA"],
    limites: ["MapIA: 20 alunos/mapa", "ProvIA: 4 questões/prova", "AvalIA: 3 triagens", "TRI: 3 simulações", "SomatorIA: 5 correções", "BuscIA: 15 msgs/semana"],
  },
  {
    id: "essencial",
    nome: "ESSENCIAL",
    preco: "R$ 39,90/mês",
    sistemas: ["Tudo do FREE"],
    limites: ["Sem os limites do FREE"],
  },
  {
    id: "profissional",
    nome: "PROFISSIONAL",
    preco: "R$ 99,90/mês",
    sistemas: ["Tudo do ESSENCIAL", "HorIA", "RemanejIA"],
    limites: ["Sem limites"],
  },
];

interface HistoricoItem {
  evento: string;
  timestamp: number;
  plano?: string;
}

interface Billing {
  billing: { status?: string; planoAtual?: string; toleranciaAte?: number };
  historico: HistoricoItem[];
}

export default function AssinaturaPage() {
  const { perfil, tenantAtivo, recarregarPerfil } = useAuth();
  const itens = useMenuItens(perfil, tenantAtivo);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [erro, setErro] = useState("");
  const [cancelar, setCancelar] = useState(false);

  const carregar = useCallback(() => {
    api.get<Billing & { sucesso: boolean }>("/billing/historico").then(setBilling).catch(() => setBilling(null));
  }, []);

  useEffect(carregar, [carregar]);

  async function assinar(plano: string) {
    setErro("");
    try {
      const r = await api.post<{ initPoint: string }>("/billing/checkout", { plano });
      window.location.href = r.initPoint;
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao iniciar assinatura.");
    }
  }

  const planoAtual = perfil?.plano.tipo ?? "free";
  const status = perfil?.plano.status ?? "ativa";

  return (
    <AppShell titulo="Assinatura" itens={itens}>
      <div className="mb-6 rounded-md border border-slate-100 p-4 text-sm text-slate-700">
        Plano atual: <strong className="uppercase">{planoAtual}</strong>
        {" · "}
        Status:{" "}
        <span className={status === "ativa" ? "text-green-700" : "text-amber-700"}>{status}</span>
        {billing?.billing.toleranciaAte && (
          <span className="ml-2 text-xs text-amber-700">
            (tolerância até {new Date(billing.billing.toleranciaAte).toLocaleDateString("pt-BR")})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANOS.map((p) => (
          <div key={p.id} className={`flex flex-col rounded-md border p-5 shadow-sm ${planoAtual === p.id ? "border-accent ring-1 ring-accent" : "border-slate-100"}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold text-slate-900">{p.nome}</h2>
              <span className="text-sm font-medium text-slate-600">{p.preco}</span>
            </div>
            <ul className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
              {p.sistemas.map((s) => (
                <li key={s}>✓ {s}</li>
              ))}
            </ul>
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-slate-400">
              {p.limites.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="mt-4">
              {planoAtual === p.id ? (
                <span className="block rounded-lg bg-slate-50 px-4 py-2 text-center text-sm text-slate-500">Plano atual</span>
              ) : p.id === "free" ? (
                <span className="block rounded-lg bg-slate-50 px-4 py-2 text-center text-sm text-slate-500">Gratuito</span>
              ) : (
                <button
                  onClick={() => assinar(p.id)}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
                >
                  {planoAtual === "free" || PLANOS.findIndex((x) => x.id === planoAtual) < PLANOS.findIndex((x) => x.id === p.id)
                    ? "Assinar"
                    : "Mudar para este plano"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {billing?.billing.status === "ativa" && (
        <button onClick={() => setCancelar(true)} className="mt-6 text-sm text-red-600 hover:underline">
          Cancelar assinatura
        </button>
      )}

      {billing && billing.historico.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-slate-600">
            {billing.historico.map((h, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-400">{new Date(h.timestamp).toLocaleString("pt-BR")}</span>
                {" — "}
                {h.evento.replaceAll("_", " ")}
                {h.plano ? ` (${h.plano})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmarAcao
        aberto={cancelar}
        mensagem="Você tem certeza que deseja realizar esta ação? Sua assinatura será cancelada e você voltará ao plano FREE."
        onCancelar={() => setCancelar(false)}
        onConfirmar={async () => {
          setCancelar(false);
          try {
            await api.post("/billing/cancelar", {});
            await recarregarPerfil();
            carregar();
          } catch (err) {
            setErro(err instanceof ApiError ? err.message : "Erro ao cancelar.");
          }
        }}
      />
    </AppShell>
  );
}
