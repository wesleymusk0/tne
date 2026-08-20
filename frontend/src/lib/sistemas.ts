import { IconeNome } from "./icones";

/** Catálogo oficial dos 11 sistemas da TNE (§6/§10). RedAI não existe; Lumora fora. */
export interface SistemaInfo {
  id: string;
  nome: string;
  descricao: string;
  href: string;
  icone: IconeNome;
}

export const SISTEMAS: Record<string, SistemaInfo> = {
  mapia: { id: "mapia", nome: "MapIA", descricao: "Geração automática de mapas de sala", href: "/sistemas/mapia", icone: "mapia" },
  horia: { id: "horia", nome: "HorIA", descricao: "Geração de horários escolares", href: "/sistemas/horia", icone: "horia" },
  somatoria: { id: "somatoria", nome: "SomatorIA", descricao: "Gabaritos e correção por somatória", href: "/sistemas/somatoria", icone: "somatoria" },
  remanejia: { id: "remanejia", nome: "RemanejIA", descricao: "Enturmação e remanejamento de turmas", href: "/sistemas/remanejia", icone: "remanejia" },
  buscia: { id: "buscia", nome: "BuscIA", descricao: "Busca ativa de faltas e atrasos", href: "/sistemas/buscia", icone: "buscia" },
  domicilia: { id: "domicilia", nome: "DomicilIA", descricao: "Atividades domiciliares", href: "/sistemas/domicilia", icone: "domicilia" },
  notas: { id: "notas", nome: "Notas", descricao: "Lançamento de notas e boletins", href: "/gestao/notas", icone: "notas" },
  presenca: { id: "presenca", nome: "Presença", descricao: "Chamada diária (C / F / A)", href: "/gestao/presenca", icone: "presenca" },
  avalia: { id: "avalia", nome: "AvalIA", descricao: "Triagem pedagógica", href: "/sistemas/avalia", icone: "avalia" },
  provia: { id: "provia", nome: "ProvIA", descricao: "Montagem de provas", href: "/sistemas/provia", icone: "provia" },
  tri: { id: "tri", nome: "Simulador TRI", descricao: "Análise de itens e proficiência", href: "/sistemas/tri", icone: "tri" },
};

export const ORDEM_SISTEMAS = [
  "mapia", "horia", "somatoria", "remanejia", "buscia", "domicilia",
  "notas", "presenca", "avalia", "provia", "tri",
];
