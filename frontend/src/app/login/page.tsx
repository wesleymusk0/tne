"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const convite = params.get("convite");
  const {
    firebaseUser,
    entrarComEmail,
    registrarComEmail,
    entrarComGoogle,
    entrarComMicrosoft,
    recarregarPerfil,
  } = useAuth();
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      if (convite) {
        try {
          await api.post("/tenants/convites/ativar", { token: convite });
          await recarregarPerfil();
        } catch {
          /* convite inválido ou já utilizado — segue para o dashboard */
        }
      }
      router.replace("/dashboard");
    })();
  }, [firebaseUser, convite, router, recarregarPerfil]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      if (modo === "entrar") {
        await entrarComEmail(email, senha);
      } else {
        await registrarComEmail(email, senha, nome);
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      const mensagens: Record<string, string> = {
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/email-already-in-use": "Este e-mail já possui cadastro.",
        "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
        "auth/invalid-email": "E-mail inválido.",
      };
      setErro(mensagens[code] ?? "Não foi possível entrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-md bg-white p-8 shadow-sm ring-1 ring-slate-100">
          <div className="mb-6 flex flex-col items-center gap-3">
            <Image src="/systematrix.jpg" alt="Systematrix" width={52} height={52} className="rounded-md" priority />
            <h1 className="text-xl font-semibold text-slate-900">Systematrix</h1>
            <p className="text-sm text-slate-500">
              {modo === "entrar" ? "Entre na sua conta" : "Crie sua conta"}
              {convite ? " para aceitar o convite" : ""}
            </p>
          </div>

          <form onSubmit={enviar} className="flex flex-col gap-3">
            {modo === "registrar" && (
              <input
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            )}
            <input
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {enviando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> ou <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => entrarComGoogle().catch(() => setErro("Falha ao entrar com Google."))}
              className="rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Entrar com Google
            </button>
            <button
              onClick={() => entrarComMicrosoft().catch(() => setErro("Falha ao entrar com Microsoft."))}
              className="rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Entrar com Microsoft
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 text-sm">
            <button
              onClick={() => setModo(modo === "entrar" ? "registrar" : "entrar")}
              className="text-primary-600 hover:underline"
            >
              {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
            </button>
            <Link href="/recuperar-senha" className="text-slate-500 hover:underline">
              Esqueci minha senha
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
