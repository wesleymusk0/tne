"""Instituições, cargos, regras institucionais e convites de usuário."""
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..core import audit, permissions, rules
from ..core.auth import UsuarioAtual, get_usuario_atual
from ..core.permissions import tem_permissao

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _vinculo(usuario: UsuarioAtual, tenant_id: str):
    vinculo = (usuario.vinculos or {}).get(tenant_id)
    if not vinculo or vinculo.get("status", "ativo") != "ativo":
        raise HTTPException(status_code=403, detail="Usuário sem vínculo ativo com esta instituição.")
    return vinculo


def _cargo_do(usuario: UsuarioAtual, tenant_id: str):
    vinculo = _vinculo(usuario, tenant_id)
    return db.get(f"tenants/{tenant_id}/cargos/{vinculo.get('cargo')}") or {}


def _exigir_instituicao(usuario: UsuarioAtual, tenant_id: str, acao: str):
    cargo = _cargo_do(usuario, tenant_id)
    if not tem_permissao(cargo, "_instituicao", acao):
        raise HTTPException(status_code=403, detail=f"Seu cargo não permite '{acao}' na instituição.")
    return cargo


@router.get("/{tenant_id}")
def obter_instituicao(tenant_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _vinculo(usuario, tenant_id)
    return {
        "sucesso": True,
        "info": db.tenant_get(tenant_id, "info") or {},
        "personalizacao": db.tenant_get(tenant_id, "personalizacao") or {},
        "contrato": db.tenant_get(tenant_id, "contrato") or {},
    }


@router.put("/{tenant_id}/personalizacao")
def salvar_personalizacao(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir_instituicao(usuario, tenant_id, "editar")
    permitidos = {k: v for k, v in body.items() if k in {"nome", "logoUrl", "cor", "headerLayout"}}
    if not permitidos:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")
    db.tenant_update(tenant_id, "personalizacao", permitidos)
    audit.registrar(db, uid=usuario.uid, acao="Atualizar personalização", tenant_id=tenant_id, contexto=permitidos)
    return {"sucesso": True}


# --- Cargos -------------------------------------------------------------------
@router.get("/{tenant_id}/cargos")
def listar_cargos(tenant_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _vinculo(usuario, tenant_id)
    cargos = db.tenant_get(tenant_id, "cargos") or {}
    return {"sucesso": True, "cargos": [{"id": k, **v} for k, v in cargos.items()]}


@router.post("/{tenant_id}/cargos")
def criar_cargo(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir_instituicao(usuario, tenant_id, "gerenciar")
    cargo = {"nome": (body.get("nome") or "").strip(), "padrao": False,
             "permissoes": body.get("permissoes") or {}}
    erros = permissions.validar_cargo(cargo)
    if erros:
        raise HTTPException(status_code=400, detail=" ".join(erros))
    ref = db.tenant_push(tenant_id, "cargos", cargo)
    audit.registrar(db, uid=usuario.uid, acao="Criar cargo", tenant_id=tenant_id, contexto={"nome": cargo["nome"]})
    return {"sucesso": True, "cargoId": ref.key}


@router.put("/{tenant_id}/cargos/{cargo_id}")
def atualizar_cargo(tenant_id: str, cargo_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir_instituicao(usuario, tenant_id, "gerenciar")
    path = db.tenant_path(tenant_id, "cargos", cargo_id)
    atual = db.get(path)
    if not atual:
        raise HTTPException(status_code=404, detail="Cargo não encontrado.")
    if atual.get("padrao") and body.get("permissoes") and body["permissoes"] != atual.get("permissoes"):
        raise HTTPException(status_code=409, detail="Cargos padrão não podem ter permissões alteradas.")
    novo = {"nome": body.get("nome", atual.get("nome")), "permissoes": body.get("permissoes", atual.get("permissoes"))}
    erros = permissions.validar_cargo(novo)
    if erros:
        raise HTTPException(status_code=400, detail=" ".join(erros))
    db.update(path, novo)
    audit.registrar(db, uid=usuario.uid, acao="Atualizar cargo", tenant_id=tenant_id, contexto={"cargoId": cargo_id})
    return {"sucesso": True}


# --- Regras institucionais -------------------------------------------------------
@router.get("/{tenant_id}/regras")
def listar_regras(tenant_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _vinculo(usuario, tenant_id)
    regras = db.tenant_get(tenant_id, "regras") or {}
    return {"sucesso": True, "regras": [{"id": k, **v} for k, v in regras.items()]}


@router.post("/{tenant_id}/regras")
def criar_regra(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir_instituicao(usuario, tenant_id, "gerenciar")
    regra = {
        "sistema": (body.get("sistema") or "").lower(),
        "periodo": body.get("periodo"),
        "limite": body.get("limite"),
        "ativa": body.get("ativa", True),
        "criadoEm": int(time.time() * 1000),
    }
    erros = rules.validar_regra(regra)
    if erros:
        raise HTTPException(status_code=400, detail=" ".join(erros))

    cargos = db.tenant_get(tenant_id, "cargos") or {}
    conflito = rules.detectar_conflito_regra_permissao(regra, cargos)
    if conflito["conflito"] and not body.get("confirmarConflito"):
        return {
            "sucesso": False,
            "conflito": True,
            "mensagem": "Conflito detectado. Esta regra entra em conflito com permissões existentes. Deseja realmente continuar?",
            "cargosAfetados": conflito["cargos_afetados"],
        }

    ref = db.tenant_push(tenant_id, "regras", regra)
    audit.registrar(db, uid=usuario.uid, acao="Criar regra", tenant_id=tenant_id,
                    contexto={"regra": regra, "conflitoConfirmado": bool(conflito["conflito"])})
    return {"sucesso": True, "regraId": ref.key}


@router.delete("/{tenant_id}/regras/{regra_id}")
def excluir_regra(tenant_id: str, regra_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir_instituicao(usuario, tenant_id, "gerenciar")
    db.delete(db.tenant_path(tenant_id, "regras", regra_id))
    audit.registrar(db, uid=usuario.uid, acao="Excluir regra", tenant_id=tenant_id, contexto={"regraId": regra_id})
    return {"sucesso": True}


# --- Convites de usuário ---------------------------------------------------------
@router.post("/{tenant_id}/convites")
def criar_convite(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Convida usuário (nome, e-mail, cargo). SEM senha — ativação no registro."""
    _exigir_instituicao(usuario, tenant_id, "gerenciar")
    nome = (body.get("nome") or "").strip()
    email = (body.get("email") or "").strip().lower()
    cargo = body.get("cargo")
    if not nome or not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Nome e e-mail válidos são obrigatórios.")
    if not db.tenant_get(tenant_id, "cargos", cargo):
        raise HTTPException(status_code=404, detail="Cargo não encontrado.")

    token = secrets.token_urlsafe(24)
    convite = {
        "tenantId": tenant_id, "nome": nome, "email": email, "cargo": cargo,
        "status": "pendente", "criadoPor": usuario.uid, "criadoEm": int(time.time() * 1000),
    }
    db.set_value(f"invites/{token}", convite)
    db.push(f"tenants/{tenant_id}/convites", {"token": token, "email": email, "nome": nome, "status": "pendente"})
    audit.registrar(db, uid=usuario.uid, acao="Criar convite", tenant_id=tenant_id, contexto={"email": email, "cargo": cargo})
    return {"sucesso": True, "token": token, "convite": convite}


@router.get("/{tenant_id}/convites")
def listar_convites(tenant_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir_instituicao(usuario, tenant_id, "gerenciar")
    convites = db.tenant_get(tenant_id, "convites") or {}
    return {"sucesso": True, "convites": list(convites.values())}


@router.post("/convites/ativar")
def ativar_convite(body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """No registro/login com o e-mail convidado: vincula conta, aplica cargo."""
    token = body.get("token")
    convite = db.get(f"invites/{token}")
    if not convite or convite.get("status") != "pendente":
        raise HTTPException(status_code=404, detail="Convite não encontrado ou já utilizado.")
    if (usuario.email or "").lower() != convite["email"]:
        raise HTTPException(status_code=403, detail="Este convite pertence a outro e-mail.")

    tenant_id = convite["tenantId"]
    db.update(f"users/{usuario.uid}/vinculos/{tenant_id}", {
        "cargo": convite["cargo"], "status": "ativo", "origem": "convite",
        "vinculadoEm": int(time.time() * 1000),
    })
    db.update(f"invites/{token}", {"status": "ativo", "ativadoEm": int(time.time() * 1000), "uid": usuario.uid})
    db.update(f"users/{usuario.uid}", {"nome": usuario.nome or convite["nome"], "email": usuario.email})
    audit.registrar(db, uid=usuario.uid, acao="Ativar convite", tenant_id=tenant_id, contexto={"email": usuario.email})
    return {"sucesso": True, "tenantId": tenant_id, "cargo": convite["cargo"]}
