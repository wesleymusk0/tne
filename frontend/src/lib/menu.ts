import { useMemo } from "react";

import { MenuItem } from "@/components/AppShell";
import { Perfil } from "./api";

export function useMenuItens(perfil: Perfil | null, tenantAtivo: string | null): MenuItem[] {
  return useMemo(() => {
    const base: MenuItem[] = [{ href: "/dashboard", rotulo: "Dashboard", icone: "🏠" }];
    if (tenantAtivo) {
      base.push(
        { href: "/gestao/turmas", rotulo: "Turmas", icone: "🏫" },
        { href: "/gestao/alunos", rotulo: "Alunos", icone: "🎓" },
        { href: "/gestao/presenca", rotulo: "Presença", icone: "✅" },
        { href: "/gestao/notas", rotulo: "Notas e Boletins", icone: "📝" },
        { href: "/instituicao", rotulo: "Instituição", icone: "⚙️" }
      );
    }
    base.push({ href: "/assinatura", rotulo: "Assinatura", icone: "💳" });
    if (perfil?.adminGlobal) base.push({ href: "/admin", rotulo: "Administração Global", icone: "🌐" });
    return base;
  }, [perfil?.adminGlobal, tenantAtivo]);
}
