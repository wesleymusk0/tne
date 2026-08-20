"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/lib/auth";

export default function RecuperarSenhaPage() {
  const { recuperarSenha } = useAuth();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await recuperarSenha(email);
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar o e-mail. Verifique o endereço informado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image src="/systematrix.jpg" alt="Systematrix" width={52} height={52} className="rounded-xl" />
          <h1 className="text-xl font-semibold text-slate-900">Recuperar senha</h1>
        </div>
        {enviado ? (
          <div className="text-center text-sm text-slate-600">
            <p>Enviamos um link de redefinição para <strong>{email}</strong>.</p>
            <p className="mt-2">Verifique sua caixa de entrada e o spam.</p>
            <Link href="/login" className="mt-4 inline-block text-primary-600 hover:underline">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Informe seu e-mail para receber o link de redefinição de senha.
            </p>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {enviando ? "Enviando..." : "Enviar link"}
            </button>
            <Link href="/login" className="text-center text-sm text-slate-500 hover:underline">
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
