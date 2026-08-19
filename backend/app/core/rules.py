"""Sistema de Regras institucionais — TNE.

DIFERENTE do sistema de permissões: regras definem limites/comportamentos
institucionais e são executadas LITERALMENTE conforme configuradas.

"Máximo de 3 Projetos de Mapa por trimestre" NÃO significa "1 por mês".
Períodos são janelas fixas de calendário (semana ISO, mês, trimestre civil,
semestre civil, ano letivo civil).
"""
from datetime import datetime, timezone

PERIODOS = {"semana", "mes", "trimestre", "semestre", "ano", "total"}

UNIDADES_PROJETO = {
    "mapia": "Projeto de Mapa",
    "remanejia": "Projeto de Turmação/Remanejamento",
    "horia": "Projeto de Horário",
    "somatoria": "Projeto de Correção",
    "avalia": "Projeto de Triagem",
    "provia": "Projeto de Prova",
    "tri": "Projeto de Simulação",
    "domicilia": "Projeto de Atividade Domiciliar",
}


def janela_periodo(periodo, dt=None):
    """Retorna (inicio, fim) em timestamp ms da janela corrente do período.

    Interpretação literal e determinística:
      semana    → semana ISO corrente
      mes       → mês civil corrente
      trimestre → trimestre civil corrente (jan–mar, abr–jun, jul–set, out–dez)
      semestre  → semestre civil corrente
      ano       → ano civil corrente (ano letivo)
      total     → sem janela (contagem acumulada)
    """
    dt = dt or datetime.now(timezone.utc)
    if periodo == "total":
        return 0, None
    if periodo == "semana":
        inicio = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
        inicio = inicio.fromtimestamp(inicio.timestamp() - dt.weekday() * 86400, tz=timezone.utc)
        fim = inicio.timestamp() + 7 * 86400
        return int(inicio.timestamp() * 1000), int(fim * 1000)
    if periodo == "mes":
        inicio = datetime(dt.year, dt.month, 1, tzinfo=timezone.utc)
        fim = datetime(dt.year + (dt.month == 12), dt.month % 12 + 1, 1, tzinfo=timezone.utc)
        return int(inicio.timestamp() * 1000), int(fim.timestamp() * 1000)
    if periodo == "trimestre":
        mes_inicio = 3 * ((dt.month - 1) // 3) + 1
        inicio = datetime(dt.year, mes_inicio, 1, tzinfo=timezone.utc)
        fim = datetime(dt.year + (mes_inicio == 10), mes_inicio % 12 + 3 if mes_inicio != 10 else 1, 1, tzinfo=timezone.utc)
        return int(inicio.timestamp() * 1000), int(fim.timestamp() * 1000)
    if periodo == "semestre":
        inicio = datetime(dt.year, 1 if dt.month <= 6 else 7, 1, tzinfo=timezone.utc)
        fim = datetime(dt.year if dt.month <= 6 else dt.year + 1, 7 if dt.month <= 6 else 1, 1, tzinfo=timezone.utc)
        return int(inicio.timestamp() * 1000), int(fim.timestamp() * 1000)
    if periodo == "ano":
        inicio = datetime(dt.year, 1, 1, tzinfo=timezone.utc)
        fim = datetime(dt.year + 1, 1, 1, tzinfo=timezone.utc)
        return int(inicio.timestamp() * 1000), int(fim.timestamp() * 1000)
    raise ValueError(f"Período inválido: {periodo}")


def validar_regra(regra):
    """Valida a estrutura de uma regra institucional. Retorna lista de erros."""
    erros = []
    if not regra.get("sistema"):
        erros.append("Sistema é obrigatório.")
    if regra.get("periodo") not in PERIODOS:
        erros.append(f"Período deve ser um de: {sorted(PERIODOS)}.")
    limite = regra.get("limite")
    if not isinstance(limite, int) or limite < 0:
        erros.append("Limite deve ser um inteiro >= 0.")
    return erros


def verificar_regra(regra, contagem_atual):
    """Verifica se a contagem atual permite nova criação sob a regra.

    (permitido, mensagem). Regra executada literalmente: limite N no período
    corrente significa no máximo N criações na janela corrente do período.
    """
    limite = int(regra.get("limite", 0))
    if contagem_atual >= limite:
        unidade = UNIDADES_PROJETO.get(regra.get("sistema", ""), "Projeto")
        periodo = regra.get("periodo", "total")
        return False, (
            f"Limite institucional atingido: máximo de {limite} "
            f"{unidade}(s) por {periodo}."
        )
    return True, "ok"


def detectar_conflito_regra_permissao(regra, cargos):
    """Detecta conflito entre uma regra e as permissões dos cargos.

    Conflito: a regra impede (limite 0) a criação em um sistema no qual pelo
    menos um cargo possui permissão de criação. A UI deve exibir o aviso e
    exigir confirmação explícita antes de salvar.
    """
    if int(regra.get("limite", 1)) > 0:
        return {"conflito": False, "cargos_afetados": []}
    sistema = (regra.get("sistema") or "").lower()
    afetados = []
    for cargo_id, cargo in (cargos or {}).items():
        perms = (cargo.get("permissoes") or {}).get(sistema) or {}
        if perms.get("criar"):
            afetados.append({"cargoId": cargo_id, "nome": cargo.get("nome", cargo_id)})
    return {"conflito": bool(afetados), "cargos_afetados": afetados}
