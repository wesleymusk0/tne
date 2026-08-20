"""Planos individuais e institucionais — TNE.

Regras de bloqueio por plano (validadas no backend, nunca só no frontend).

Limites do FREE (decisão registrada em PLANO-TNE.md #5):
  MapIA: 20 alunos por mapa · ProvIA: 4 questões por prova
  AvalIA: 3 triagens · TRI: 3 simulações · SomatorIA: 5 correções
  BuscIA: 15 mensagens por semana
"""
from datetime import datetime, timezone

SISTEMAS = [
    "mapia", "horia", "somatoria", "remanejia", "buscia", "domicilia",
    "notas", "presenca", "avalia", "provia", "tri",
]

PLANOS = {
    "free": {
        "nome": "FREE",
        "preco_mensal": 0.0,
        "sistemas": ["mapia", "provia", "avalia", "somatoria", "tri", "buscia"],
        "limites": {
            "mapia": {"max_alunos_por_mapa": 20},
            "provia": {"max_questoes_por_prova": 4},
            "avalia": {"max_triagens": 3},
            "tri": {"max_simulacoes": 3},
            "somatoria": {"max_correcoes": 5},
            "buscia": {"max_mensagens_semana": 15},
        },
    },
    "essencial": {
        "nome": "ESSENCIAL",
        "preco_mensal": 39.90,
        "sistemas": ["mapia", "provia", "avalia", "somatoria", "tri", "buscia"],
        "limites": {},
    },
    "profissional": {
        "nome": "PROFISSIONAL",
        "preco_mensal": 99.90,
        "sistemas": ["mapia", "provia", "avalia", "somatoria", "tri", "buscia", "horia", "remanejia"],
        "limites": {},
    },
}

STATUS_ASSINATURA_ATIVOS = {"ativa", "em_tolerancia"}


def get_plano(tipo):
    return PLANOS.get((tipo or "free").lower(), PLANOS["free"])


def sistema_liberado(tipo_plano, sistema):
    return sistema.lower() in get_plano(tipo_plano)["sistemas"]


def verificar_acesso_sistema(tipo_plano, status_assinatura, sistema):
    """Retorna (permitido, mensagem). Bloqueio por plano + status financeiro."""
    if (status_assinatura or "ativa") not in STATUS_ASSINATURA_ATIVOS:
        return False, "Assinatura suspensa. Regularize o pagamento para continuar."
    if not sistema_liberado(tipo_plano, sistema):
        return False, f"O sistema {sistema} não está disponível no seu plano."
    return True, "ok"


def verificar_limite(tipo_plano, sistema, chave, valor_atual):
    """Verifica um limite numérico do plano FREE.

    (permitido, mensagem). valor_atual = uso/contagem atual ANTES da operação.
    """
    limite = get_plano(tipo_plano)["limites"].get(sistema.lower(), {}).get(chave)
    if limite is None:
        return True, "ok"
    if valor_atual >= limite:
        return False, f"Limite do plano FREE atingido ({chave}: {limite}). Faça upgrade para continuar."
    return True, "ok"


def verificar_tamanho_maximo(tipo_plano, sistema, chave, quantidade):
    """Limite por objeto (ex.: 20 alunos por mapa, 4 questões por prova).

    Bloqueia quando quantidade > limite. Planos sem o limite passam sempre.
    """
    limite = get_plano(tipo_plano)["limites"].get(sistema.lower(), {}).get(chave)
    if limite is None:
        return True, "ok"
    if quantidade > limite:
        return False, f"Limite do plano FREE: máximo de {limite} ({chave}). Faça upgrade para continuar."
    return True, "ok"


def semana_atual(dt=None):
    """Chave de semana ISO para o limite semanal do BuscIA."""
    dt = dt or datetime.now(timezone.utc)
    ano, semana, _ = dt.isocalendar()
    return f"{ano}-W{semana:02d}"


def sistemas_escola(contrato):
    """Plano ESCOLA: somente sistemas contratados, sem limites internos."""
    contrato = contrato or {}
    if contrato.get("status") != "ativo":
        return []
    return [str(s).lower() for s in contrato.get("sistemas", [])]
