"""Sistema de Permissões — TNE.

Cargos padrão: administrador, gestor, professor, responsável.
A instituição pode criar cargos personalizados com permissões granulares:
sistemas visíveis, menus, abas e ações (criar, editar, excluir, visualizar,
emitir, gerenciar). Todos os usuários do cargo herdam suas permissões.

Nota: "aluno" não é cargo padrão nesta TNE (será introduzido com o Lumora).
"""

ACOES = ["visualizar", "criar", "editar", "excluir", "emitir", "gerenciar"]

SISTEMAS_INSTITUCIONAIS = [
    "mapia", "horia", "somatoria", "remanejia", "buscia", "domicilia",
    "notas", "presenca", "avalia", "provia", "tri",
]

CARGOS_PADRAO = {
    "administrador": {
        "nome": "Administrador",
        "padrao": True,
        "permissoes": {
            s: {a: True for a in ACOES} for s in SISTEMAS_INSTITUCIONAIS
        } | {"_instituicao": {a: True for a in ACOES}},
    },
    "gestor": {
        "nome": "Gestor",
        "padrao": True,
        "permissoes": {
            **{s: {a: True for a in ACOES} for s in SISTEMAS_INSTITUCIONAIS},
            "_instituicao": {"visualizar": True, "criar": False, "editar": True,
                             "excluir": False, "emitir": False, "gerenciar": False},
        },
    },
    "professor": {
        "nome": "Professor",
        "padrao": True,
        "permissoes": {
            "mapia": {"visualizar": True, "criar": True, "editar": True, "excluir": True, "emitir": True, "gerenciar": False},
            "somatoria": {"visualizar": True, "criar": True, "editar": True, "excluir": True, "emitir": True, "gerenciar": False},
            "avalia": {"visualizar": True, "criar": True, "editar": True, "excluir": True, "emitir": True, "gerenciar": False},
            "provia": {"visualizar": True, "criar": True, "editar": True, "excluir": True, "emitir": True, "gerenciar": False},
            "tri": {"visualizar": True, "criar": True, "editar": True, "excluir": True, "emitir": True, "gerenciar": False},
            "notas": {"visualizar": True, "criar": True, "editar": True, "excluir": False, "emitir": False, "gerenciar": False},
            "presenca": {"visualizar": True, "criar": True, "editar": True, "excluir": False, "emitir": False, "gerenciar": False},
            "domicilia": {"visualizar": True, "criar": True, "editar": True, "excluir": True, "emitir": True, "gerenciar": False},
            "buscia": {"visualizar": True, "criar": True, "editar": False, "excluir": False, "emitir": True, "gerenciar": False},
            "horia": {"visualizar": True, "criar": False, "editar": False, "excluir": False, "emitir": False, "gerenciar": False},
            "remanejia": {"visualizar": False, "criar": False, "editar": False, "excluir": False, "emitir": False, "gerenciar": False},
        },
    },
    "responsavel": {
        "nome": "Responsável",
        "padrao": True,
        "permissoes": {
            s: {"visualizar": False, "criar": False, "editar": False, "excluir": False, "emitir": False, "gerenciar": False}
            for s in SISTEMAS_INSTITUCIONAIS
        } | {
            "notas": {"visualizar": True, "criar": False, "editar": False, "excluir": False, "emitir": False, "gerenciar": False},
            "presenca": {"visualizar": True, "criar": False, "editar": False, "excluir": False, "emitir": False, "gerenciar": False},
            "domicilia": {"visualizar": True, "criar": False, "editar": False, "excluir": False, "emitir": False, "gerenciar": False},
        },
    },
}


def tem_permissao(cargo, sistema, acao):
    """Verifica permissão de um cargo sobre (sistema, ação)."""
    if not cargo:
        return False
    perms = (cargo.get("permissoes") or {}).get((sistema or "").lower()) or {}
    return bool(perms.get(acao))


def sistemas_visiveis(cargo, sistemas_contratados=None):
    """Sistemas visíveis = permissão de visualização ∧ (contrato, se informado)."""
    if not cargo:
        return []
    visiveis = [
        s for s, perms in (cargo.get("permissoes") or {}).items()
        if not s.startswith("_") and perms.get("visualizar")
    ]
    if sistemas_contratados is not None:
        contratados = {s.lower() for s in sistemas_contratados}
        visiveis = [s for s in visiveis if s in contratados]
    return sorted(visiveis)


def validar_cargo(cargo):
    erros = []
    if not (cargo.get("nome") or "").strip():
        erros.append("Nome do cargo é obrigatório.")
    perms = cargo.get("permissoes")
    if not isinstance(perms, dict):
        erros.append("Permissões devem ser um objeto por sistema.")
    else:
        for sistema, acoes in perms.items():
            if not isinstance(acoes, dict):
                erros.append(f"Permissões de '{sistema}' devem ser um objeto de ações.")
                continue
            for acao in acoes:
                if acao not in ACOES:
                    erros.append(f"Ação desconhecida em '{sistema}': {acao}.")
    return erros
