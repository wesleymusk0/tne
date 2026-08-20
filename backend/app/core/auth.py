"""Autenticação e contexto de usuário — Firebase ID token obrigatório.

Corrige a falha crítica do backend legado: toda rota valida o token JWT
emitido pelo Firebase Authentication; o uid NUNCA vem do corpo da requisição.
"""
from dataclasses import dataclass, field

from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as fb_auth

from app import db


@dataclass
class UsuarioAtual:
    uid: str
    email: str | None = None
    nome: str | None = None
    plano: dict = field(default_factory=dict)
    vinculos: dict = field(default_factory=dict)
    admin_global: bool = False


def _verificar_token(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticação ausente.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token de autenticação ausente.")
    try:
        return fb_auth.verify_id_token(token)
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expirado. Faça login novamente.")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido.")


def get_usuario_atual(authorization: str | None = Header(default=None)) -> UsuarioAtual:
    claims = _verificar_token(authorization)
    uid = claims["uid"]

    dados = db.get(f"users/{uid}") or {}
    return UsuarioAtual(
        uid=uid,
        email=claims.get("email") or dados.get("email"),
        nome=dados.get("nome") or claims.get("name"),
        plano=dados.get("plano") or {"tipo": "free", "status": "ativa"},
        vinculos=dados.get("vinculos") or {},
        admin_global=bool(claims.get("admin_global")) or bool(dados.get("adminGlobal")),
    )


def get_vinculo(usuario: UsuarioAtual, tenant_id: str) -> dict:
    vinculo = (usuario.vinculos or {}).get(tenant_id)
    if not vinculo or vinculo.get("status", "ativo") != "ativo":
        raise HTTPException(status_code=403, detail="Usuário sem vínculo ativo com esta instituição.")
    return vinculo


def exigir_admin_global(usuario: UsuarioAtual = Depends(get_usuario_atual)) -> UsuarioAtual:
    if not usuario.admin_global:
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador global.")
    return usuario
