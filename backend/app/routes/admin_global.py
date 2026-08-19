"""Painel Administrativo Global — TNE §41–44.

Toda ação administrativa exige confirmação explícita (confirmacao=true) e é
auditada. "Entrar na visão da instituição" é SOMENTE LEITURA e com escopo
reduzido: sem notas individuais nem dados sensíveis de alunos.
"""
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..core import audit, permissions
from ..core.auth import UsuarioAtual, exigir_admin_global

router = APIRouter(prefix="/admin-global", tags=["admin-global"])


def _exigir_confirmacao(body: dict):
    if body.get("confirmacao") is not True:
        raise HTTPException(status_code=428, detail="Confirmação obrigatória para ações administrativas.")


@router.get("/instituicoes")
def listar_instituicoes(usuario: UsuarioAtual = Depends(exigir_admin_global)):
    insts = db.get("tenants") or {}
    lista = []
    for tid, dados in insts.items():
        info = dados.get("info") or {}
        contrato = dados.get("contrato") or {}
        lista.append({
            "id": tid, "nome": info.get("nome"), "status": contrato.get("status"),
            "sistemas": contrato.get("sistemas", []),
            "totais": {
                "turmas": len(dados.get("turmas") or {}),
                "alunos": len(dados.get("alunos") or {}),
                "usuarios": len([u for u in (db.get("users") or {}).values()
                                 if tid in (u.get("vinculos") or {})]),
            },
        })
    return {"sucesso": True, "instituicoes": lista}


@router.post("/instituicoes")
def criar_instituicao(body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    nome = (body.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da instituição é obrigatório.")
    ref = db.push("tenants", {})
    tid = ref.key
    db.set_value(f"tenants/{tid}/info", {"nome": nome, "criadoEm": int(time.time() * 1000), "criadoPor": usuario.uid})
    db.set_value(f"tenants/{tid}/contrato", {
        "sistemas": body.get("sistemas", []), "status": body.get("status", "ativo"),
        "inicio": body.get("inicio"), "fim": body.get("fim"),
    })
    db.set_value(f"tenants/{tid}/cargos", permissions.CARGOS_PADRAO)
    db.set_value(f"global/instituicoes/{tid}", {"nome": nome, "status": body.get("status", "ativo")})
    audit.registrar(db, uid=usuario.uid, acao="Criar instituição", tenant_id=tid, contexto={"nome": nome})
    return {"sucesso": True, "instituicaoId": tid}


@router.put("/instituicoes/{tenant_id}")
def editar_instituicao(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    if not db.tenant_get(tenant_id, "info"):
        raise HTTPException(status_code=404, detail="Instituição não encontrada.")
    info = {k: v for k, v in (body.get("info") or {}).items() if k in {"nome", "logoUrl"}}
    if info:
        db.tenant_update(tenant_id, "info", info)
    contrato = {k: v for k, v in (body.get("contrato") or {}).items() if k in {"sistemas", "status", "inicio", "fim"}}
    if contrato:
        db.tenant_update(tenant_id, "contrato", contrato)
    audit.registrar(db, uid=usuario.uid, acao="Editar instituição", tenant_id=tenant_id,
                    contexto={"info": info, "contrato": contrato})
    return {"sucesso": True}


@router.post("/instituicoes/{tenant_id}/status")
def alterar_status_instituicao(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    status = body.get("status")
    if status not in ("ativo", "suspenso"):
        raise HTTPException(status_code=400, detail="Status inválido (ativo/suspenso).")
    db.tenant_update(tenant_id, "contrato", {"status": status})
    audit.registrar(db, uid=usuario.uid, acao=f"{'Suspender' if status == 'suspenso' else 'Reativar'} instituição",
                    tenant_id=tenant_id)
    return {"sucesso": True}


@router.delete("/instituicoes/{tenant_id}")
def excluir_instituicao(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    db.delete(f"tenants/{tenant_id}")
    db.delete(f"global/instituicoes/{tenant_id}")
    audit.registrar(db, uid=usuario.uid, acao="Excluir instituição", tenant_id=tenant_id, resultado="sucesso")
    return {"sucesso": True}


@router.get("/instituicoes/{tenant_id}/visao")
def visao_instituicao(tenant_id: str, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    """Visão SOMENTE LEITURA e de escopo reduzido da instituição.

    Não expõe notas individuais, dados sensíveis de alunos (necessidades,
    documentos) nem contatos de responsáveis.
    """
    dados = db.get(f"tenants/{tenant_id}") or {}
    if not dados:
        raise HTTPException(status_code=404, detail="Instituição não encontrada.")
    alunos = dados.get("alunos") or {}
    return {"sucesso": True, "visao": {
        "info": dados.get("info") or {},
        "contrato": dados.get("contrato") or {},
        "cargos": [{"id": k, "nome": v.get("nome"), "padrao": v.get("padrao", False)}
                   for k, v in (dados.get("cargos") or {}).items()],
        "turmas": [{"id": k, "nome": v.get("nome")} for k, v in (dados.get("turmas") or {}).items()],
        "totais": {"alunos": len(alunos), "turmas": len(dados.get("turmas") or {}),
                   "projetos": sum(len(p or {}) for p in (dados.get("projetos") or {}).values())},
        "audit": sorted((dados.get("audit") or {}).values(), key=lambda r: r.get("timestamp", 0), reverse=True)[:50],
    }}


# --- Troca de administrador principal (fluxo via suporte — TNE §43) ---------
@router.post("/instituicoes/{tenant_id}/troca-admin/solicitar")
def solicitar_troca_admin(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    novo_uid = body.get("novoAdminUid")
    if not novo_uid or not db.get(f"users/{novo_uid}"):
        raise HTTPException(status_code=404, detail="Novo administrador não encontrado.")
    token = secrets.token_urlsafe(24)
    db.set_value(f"global/trocas-admin/{token}", {
        "tenantId": tenant_id, "novoAdminUid": novo_uid, "solicitadoPor": usuario.uid,
        "status": "aguardando_confirmacao", "criadoEm": int(time.time() * 1000),
        "expiraEm": int((time.time() + 48 * 3600) * 1000),
    })
    audit.registrar(db, uid=usuario.uid, acao="Solicitar troca de admin principal", tenant_id=tenant_id,
                    contexto={"novoAdminUid": novo_uid})
    return {"sucesso": True, "token": token, "janelaHoras": 48}


@router.post("/instituicoes/{tenant_id}/troca-admin/executar")
def executar_troca_admin(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    token = body.get("token")
    troca = db.get(f"global/trocas-admin/{token}")
    agora = int(time.time() * 1000)
    if not troca or troca.get("tenantId") != tenant_id or troca.get("status") != "aguardando_confirmacao":
        raise HTTPException(status_code=404, detail="Solicitação inválida ou já processada.")
    if troca.get("expiraEm", 0) < agora:
        db.update(f"global/trocas-admin/{token}", {"status": "expirada"})
        raise HTTPException(status_code=410, detail="Solicitação expirada (janela de 48h).")

    novo_uid = troca["novoAdminUid"]
    usuarios = db.get("users") or {}
    admin_cargo_id = next((cid for cid, c in (db.tenant_get(tenant_id, "cargos") or {}).items()
                           if c.get("padrao") and c.get("nome") == "Administrador"), "administrador")
    for uid, u in usuarios.items():
        vinculo = (u.get("vinculos") or {}).get(tenant_id)
        if vinculo and vinculo.get("cargo") == admin_cargo_id and uid != novo_uid:
            db.update(f"users/{uid}/vinculos/{tenant_id}", {"cargoAnterior": vinculo.get("cargo"), "cargo": "gestor"})
    db.update(f"users/{novo_uid}/vinculos/{tenant_id}", {"cargo": admin_cargo_id, "status": "ativo"})
    db.update(f"global/trocas-admin/{token}", {"status": "executada", "executadoEm": agora})
    audit.registrar(db, uid=usuario.uid, acao="Executar troca de admin principal", tenant_id=tenant_id,
                    contexto={"novoAdminUid": novo_uid})
    return {"sucesso": True}


# --- Configurações globais + auditoria ----------------------------------------
@router.put("/config/tolerancia")
def configurar_tolerancia(body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    dias = body.get("dias")
    if not isinstance(dias, int) or dias < 0:
        raise HTTPException(status_code=400, detail="Dias deve ser inteiro >= 0.")
    db.set_value("config/toleranciaDias", dias)
    audit.registrar(db, uid=usuario.uid, acao="Configurar tolerância de pagamento", contexto={"dias": dias})
    return {"sucesso": True}


@router.put("/config/manutencao")
def configurar_manutencao(body: dict, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    _exigir_confirmacao(body)
    db.set_value("config/manutencao", bool(body.get("ativa")))
    audit.registrar(db, uid=usuario.uid, acao="Alternar modo manutenção", contexto={"ativa": bool(body.get("ativa"))})
    return {"sucesso": True}


@router.get("/audit")
def consultar_auditoria(limite: int = 100, usuario: UsuarioAtual = Depends(exigir_admin_global)):
    logs = db.get("global/audit") or {}
    ordenados = sorted(logs.values(), key=lambda r: r.get("timestamp", 0), reverse=True)
    return {"sucesso": True, "logs": ordenados[: max(1, min(limite, 500))]}


@router.get("/estatisticas")
def estatisticas_gerais(usuario: UsuarioAtual = Depends(exigir_admin_global)):
    tenants = db.get("tenants") or {}
    usuarios = db.get("users") or {}
    billing = db.get("billing") or {}
    planos = {}
    for u in usuarios.values():
        tipo = (u.get("plano") or {}).get("tipo", "free")
        planos[tipo] = planos.get(tipo, 0) + 1
    return {"sucesso": True, "estatisticas": {
        "instituicoes": len(tenants),
        "usuarios": len(usuarios),
        "assinaturasAtivas": sum(1 for b in billing.values() if b.get("status") == "ativa"),
        "assinaturasEmTolerancia": sum(1 for b in billing.values() if b.get("status") == "em_tolerancia"),
        "planos": planos,
    }}
