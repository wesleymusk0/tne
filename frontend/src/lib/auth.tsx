"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, getPerfil, Perfil } from "./api";
import { auth, googleProvider, microsoftProvider } from "./firebase";

interface AuthContextData {
  firebaseUser: User | null;
  perfil: Perfil | null;
  carregando: boolean;
  tenantAtivo: string | null;
  setTenantAtivo: (tenant: string | null) => void;
  entrarComEmail: (email: string, senha: string) => Promise<void>;
  registrarComEmail: (email: string, senha: string, nome: string) => Promise<void>;
  entrarComGoogle: () => Promise<void>;
  entrarComMicrosoft: () => Promise<void>;
  recuperarSenha: (email: string) => Promise<void>;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tenantAtivo, setTenantAtivoState] = useState<string | null>(null);

  const recarregarPerfil = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const resp = await getPerfil();
      setPerfil(resp);
      // Contexto pessoal é o padrão: NÃO selecionar instituição automaticamente.
      // Mantém o tenant apenas se o vínculo ainda existir.
      setTenantAtivoState((atual) => (atual && resp.vinculos[atual] ? atual : null));
    } catch {
      setPerfil(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await recarregarPerfil();
      } else {
        setPerfil(null);
        setTenantAtivoState(null);
      }
      setCarregando(false);
    });
    return unsub;
  }, [recarregarPerfil]);

  const value = useMemo<AuthContextData>(
    () => ({
      firebaseUser,
      perfil,
      carregando,
      tenantAtivo,
      setTenantAtivo: setTenantAtivoState,
      entrarComEmail: async (email, senha) => {
        await signInWithEmailAndPassword(auth, email, senha);
      },
      registrarComEmail: async (email, senha, nome) => {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        const { updateProfile } = await import("firebase/auth");
        await updateProfile(cred.user, { displayName: nome });
        await api.put("/me", { nome, email }).catch(() => undefined);
      },
      entrarComGoogle: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      entrarComMicrosoft: async () => {
        await signInWithPopup(auth, microsoftProvider);
      },
      recuperarSenha: async (email) => {
        await sendPasswordResetEmail(auth, email);
      },
      sair: async () => {
        await signOut(auth);
      },
      recarregarPerfil,
    }),
    [firebaseUser, perfil, carregando, tenantAtivo, recarregarPerfil]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
