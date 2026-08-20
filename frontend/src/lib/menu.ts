import { useMemo } from "react";

import { MenuItem } from "@/components/AppShell";
import { Perfil } from "./api";
import { SISTEMAS } from "./sistemas";

export function useMenuItens(perfil: Perfil | null, tenantAtivo: string | null): MenuItem[] {
  return useMemo(() => {
    const base: MenuItem[] = [{ href: "/dashboard", rotulo: "Dashboard", icone: "dashboard" }];
    if (tenantAtivo) {
      base.push(
        { href: "/gestao/turmas", rotulo: "Turmas", icone: "turmas" },
        { href: "/gestao/alunos", rotulo: "Alunos", icone: "alunos" },
        { href: "/gestao/presenca", rotulo: "Presença", icone: "presenca" },
        { href: "/gestao/notas", rotulo: "Notas e Boletins", icone: "notas" },
        { href: "/instituicao", rotulo: "Instituição", icone: "instituicao" }
      );
    }
    base.push({ href: "/assinatura", rotulo: "Assinatura", icone: "assinatura" });
    if (perfil?.adminGlobal) base.push({ href: "/admin", rotulo: "Administração Global", icone: "admin" });
    return base;
  }, [perfil?.adminGlobal, tenantAtivo]);
}

/** Menu para uma página de sistema (isolamento visual: Dashboard + o próprio sistema). */
export function menuParaSistema(id: string): MenuItem[] {
  return [
    { href: "/dashboard", rotulo: "Dashboard", icone: "dashboard" },
    { href: SISTEMAS[id].href, rotulo: SISTEMAS[id].nome, icone: SISTEMAS[id].icone },
  ];
}
