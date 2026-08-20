"""Verificação de contexto de acesso (plano individual ou instituição)."""
from fastapi import HTTPException

from app import db
from app.core import plans
from app.core.auth import UsuarioAtual
from app.core.permissions import tem_permissao


def checar_contexto(usuario: UsuarioAtual, tenant_id: str | None, sistema: str, acao: str = "criar") -> dict:
    """Individual → verifica plano; institucional → vínculo + contrato + permissão."""
    sistema = (sistema or "").lower()
    if not tenant_id:
        tipo = (usuario.plano or {}).get("tipo", "free")
        status = (usuario.plano or {}).get("status", "ativa")
        ok, msg = plans.verificar_acesso_sistema(tipo, status, sistema)
        if not ok:
            raise HTTPException(status_code=403, detail=msg)
        return {"tipo": "individual", "plano": tipo}

    vinculo = (usuario.vinculos or {}).get(tenant_id)
    if not vinculo or vinculo.get("status", "ativo") != "ativo":
        raise HTTPException(status_code=403, detail="Usuário sem vínculo ativo com esta instituição.")

    contrato = db.get(f"tenants/{tenant_id}/contrato") or {}
    contratados = plans.sistemas_escola(contrato)
    if sistema not in contratados:
        raise HTTPException(status_code=403, detail=f"Sistema {sistema} não contratado pela instituição.")

    cargo_id = vinculo.get("cargo")
    cargo = db.get(f"tenants/{tenant_id}/cargos/{cargo_id}") or {}
    if not tem_permissao(cargo, sistema, acao):
        raise HTTPException(status_code=403, detail=f"Seu cargo não permite '{acao}' em {sistema}.")
    return {"tipo": "institucional", "cargo": cargo_id}
