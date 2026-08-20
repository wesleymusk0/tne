import React from "react";

/** Ícones SVG consistentes (stroke 1.6, 18x18) — sem emojis. */
export type IconeNome =
  | "dashboard" | "turmas" | "alunos" | "presenca" | "notas" | "instituicao"
  | "assinatura" | "admin" | "mapia" | "horia" | "somatoria" | "remanejia"
  | "buscia" | "domicilia" | "avalia" | "provia" | "tri";

const PATHS: Record<IconeNome, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="12" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="12" width="6" height="6" rx="1" />
      <rect x="12" y="12" width="6" height="6" rx="1" />
    </>
  ),
  turmas: (
    <>
      <path d="M4 21V5l8-3v19" />
      <path d="M12 13h7" />
      <path d="M7 9h4M7 13h4" />
    </>
  ),
  alunos: (
    <>
      <circle cx="11" cy="7" r="3.2" />
      <path d="M4.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
    </>
  ),
  presenca: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.8 2.8L16.5 9.8" />
    </>
  ),
  notas: (
    <>
      <path d="M6 3.5h9L18 7v11.5H6z" />
      <path d="M15 3.5V7h3" />
      <path d="M9 11h6M9 14h6" />
    </>
  ),
  instituicao: (
    <>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 4v2M12 18v2M4.6 6.5l1.7 1M19.4 12l-1.7 1M6.5 19.4l1-1.7M12 4.6a7.4 7.4 0 0 1 7.4 7.4M4.6 12A7.4 7.4 0 0 1 12 4.6" />
    </>
  ),
  assinatura: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M3.5 12h17M12 3.2c2.8 2.3 2.8 15.3 0 17.6M12 3.2c-2.8 2.3-2.8 15.3 0 17.6" />
    </>
  ),
  mapia: (
    <>
      <path d="M3 6.5v12l6-2.5 6 2.5 6-2.5v-12l-6 2.5-6-2.5z" />
      <path d="M9 4v12.5M15 6.5v12.5" />
    </>
  ),
  horia: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  somatoria: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </>
  ),
  remanejia: (
    <>
      <path d="M4 7h10M4 12h13M7 17h7" />
      <path d="M17 7l-2.5-2M17 7l-2.5 2M17 12l-2.5-2M17 12l-2.5 2" />
    </>
  ),
  buscia: (
    <>
      <path d="M4 8v8h3l6 4V4L7 8z" />
      <path d="M16 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  domicilia: (
    <>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </>
  ),
  avalia: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  provia: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 7.5h8M8 11h8M8 14.5h5" />
    </>
  ),
  tri: (
    <>
      <path d="M4 20V9M9 20V4M14 20v-8M19 20V6" />
    </>
  ),
};

export function Icone({ nome, className = "h-5 w-5" }: { nome: IconeNome; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[nome]}
    </svg>
  );
}
