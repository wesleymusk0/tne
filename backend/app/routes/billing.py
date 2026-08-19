"""Assinaturas individuais — Mercado Pago (TNE §36–37).

Mensal recorrente via Preapproval. Upgrade/downgrade/cancelamento com efeito
imediato após confirmação do pagamento (webhook). Falha de pagamento abre
período de tolerância (padrão 7 dias, configurável pelo admin global em
config/toleranciaDias); após a tolerância, acesso é suspenso.

Plano ESCOLA não usa Mercado Pago (configurado manualmente pelo admin global).
"""
import hashlib
import hmac
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from .. import config, db
from ..core import audit
from ..core.auth import UsuarioAtual, get_usuario_atual

router = APIRouter(prefix="/billing", tags=["billing"])

MP_API = "https://api.mercadopago.com"


def _mp_headers():
    if not config.MERCADO_PAGO_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Mercado Pago não configurado no backend.")
    return {"Authorization": f"Bearer {config.MERCADO_PAGO_ACCESS_TOKEN}", "Content-Type": "application/json"}


def _registrar_historico(uid, evento):
    db.push(f"billing/{uid}/historico", {**evento, "timestamp": int(time.time() * 1000)})


@router.post("/checkout")
def criar_checkout(body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    plano = (body.get("plano") or "").lower()
    from ..core import plans
    if plano not in ("essencial", "profissional"):
        raise HTTPException(status_code=400, detail="Plano inválido para assinatura (essencial ou profissional).")

    payload = {
        "reason": f"Systematrix {plans.PLANOS[plano]['nome']}",
        "external_reference": f"uid:{usuario.uid}|plano:{plano}",
        "payer_email": usuario.email,
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": plans.PLANOS[plano]["preco_mensal"],
            "currency_id": "BRL",
        },
        "back_url": f"{config.APP_BASE_URL}/assinatura/retorno",
        "status": "pending",
    }
    resp = httpx.post(f"{MP_API}/preapproval", json=payload, headers=_mp_headers(), timeout=30)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="Falha ao criar assinatura no Mercado Pago.")
    dados = resp.json()
    db.update(f"billing/{usuario.uid}", {
        "assinaturaId": dados.get("id"), "planoPendente": plano, "status": "pendente",
    })
    _registrar_historico(usuario.uid, {"evento": "checkout_criado", "plano": plano, "assinaturaId": dados.get("id")})
    return {"sucesso": True, "initPoint": dados.get("init_point"), "assinaturaId": dados.get("id")}


def _aplicar_plano(uid, tipo, status="ativa"):
    db.update(f"users/{uid}/plano", {"tipo": tipo, "status": status, "atualizadoEm": int(time.time() * 1000)})


def _processar_evento_mp(tipo_evento, dados):
    """Atualiza assinatura conforme evento do Mercado Pago.

    Efeito imediato após confirmação do pagamento (TNE §36).
    """
    assinatura_id = (dados or {}).get("id")
    if not assinatura_id:
        return
    billing = db.get("billing") or {}
    alvo = next(((uid, b) for uid, b in billing.items() if b.get("assinaturaId") == assinatura_id), None)
    if not alvo:
        return
    uid, reg = alvo

    if tipo_evento in ("subscription_preapproval", "preapproval"):
        resp = httpx.get(f"{MP_API}/preapproval/{assinatura_id}", headers=_mp_headers(), timeout=30)
        if resp.status_code >= 400:
            return
        preapproval = resp.json()
        status_mp = preapproval.get("status")
        ref = preapproval.get("external_reference", "")
        plano = next((p.split(":", 1)[1] for p in ref.split("|") if p.startswith("plano:")), reg.get("planoPendente", "free"))
        if status_mp == "authorized":
            _aplicar_plano(uid, plano, "ativa")
            db.update(f"billing/{uid}", {"status": "ativa", "planoAtual": plano, "toleranciaAte": None})
            _registrar_historico(uid, {"evento": "assinatura_ativa", "plano": plano})
        elif status_mp in ("cancelled", "paused"):
            _aplicar_plano(uid, "free", "ativa")
            db.update(f"billing/{uid}", {"status": "cancelada"})
            _registrar_historico(uid, {"evento": "assinatura_cancelada"})
    elif tipo_evento in ("subscription_authorized_payment", "authorized_payment"):
        resp = httpx.get(f"{MP_API}/authorized_payments/{assinatura_id}", headers=_mp_headers(), timeout=30)
        if resp.status_code >= 400:
            return
        pagamento = resp.json()
        status_pagamento = (pagamento.get("payment") or {}).get("status")
        if status_pagamento == "approved":
            _registrar_historico(uid, {"evento": "pagamento_aprovado", "paymentId": pagamento.get("payment", {}).get("id")})
            db.update(f"billing/{uid}", {"status": "ativa", "toleranciaAte": None})
            if reg.get("planoAtual"):
                _aplicar_plano(uid, reg["planoAtual"], "ativa")
        elif status_pagamento in ("rejected", "cancelled"):
            tolerancia_dias = int(db.get("config/toleranciaDias") or config.DEFAULT_TOLERANCIA_DIAS)
            tolerancia_ate = int((time.time() + tolerancia_dias * 86400) * 1000)
            db.update(f"billing/{uid}", {"status": "em_tolerancia", "toleranciaAte": tolerancia_ate})
            _aplicar_plano(uid, reg.get("planoAtual", "free"), "em_tolerancia")
            _registrar_historico(uid, {"evento": "pagamento_falhou", "toleranciaAte": tolerancia_ate})


@router.post("/webhook")
async def webhook_mercado_pago(request: Request):
    body = await request.json()
    assinatura = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")
    data_id = str((body.get("data") or {}).get("id") or "")

    if config.MERCADO_PAGO_WEBHOOK_SECRET:
        partes = dict(p.split("=", 1) for p in assinatura.split(",") if "=" in p)
        manifest = f"id:{data_id};request-id:{request_id};ts:{partes.get('ts', '')};"
        esperado = hmac.new(config.MERCADO_PAGO_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(esperado, partes.get("v1", "")):
            raise HTTPException(status_code=401, detail="Assinatura de webhook inválida.")

    _processar_evento_mp(body.get("type") or body.get("topic"), body.get("data") or {})
    return {"sucesso": True}


@router.post("/cancelar")
def cancelar_assinatura(usuario: UsuarioAtual = Depends(get_usuario_atual)):
    reg = db.get(f"billing/{usuario.uid}") or {}
    assinatura_id = reg.get("assinaturaId")
    if not assinatura_id:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa encontrada.")
    resp = httpx.put(f"{MP_API}/preapproval/{assinatura_id}", json={"status": "cancelled"},
                     headers=_mp_headers(), timeout=30)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="Falha ao cancelar no Mercado Pago.")
    _aplicar_plano(usuario.uid, "free", "ativa")
    db.update(f"billing/{usuario.uid}", {"status": "cancelada"})
    _registrar_historico(usuario.uid, {"evento": "cancelamento_solicitado"})
    audit.registrar(db, uid=usuario.uid, acao="Cancelar assinatura")
    return {"sucesso": True}


@router.post("/alterar-plano")
def alterar_plano(body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Upgrade/downgrade: cancela a assinatura atual e cria checkout do novo plano.

    O novo plano só passa a valer após confirmação do pagamento (webhook).
    """
    novo = (body.get("plano") or "").lower()
    reg = db.get(f"billing/{usuario.uid}") or {}
    if reg.get("assinaturaId") and reg.get("status") in ("ativa", "em_tolerancia"):
        httpx.put(f"{MP_API}/preapproval/{reg['assinaturaId']}", json={"status": "cancelled"},
                  headers=_mp_headers(), timeout=30)
        _registrar_historico(usuario.uid, {"evento": "substituicao_assinatura", "anterior": reg.get("planoAtual")})
    return criar_checkout({"plano": novo}, usuario)


@router.get("/historico")
def historico(usuario: UsuarioAtual = Depends(get_usuario_atual)):
    reg = db.get(f"billing/{usuario.uid}") or {}
    historico = db.get(f"billing/{usuario.uid}/historico") or {}
    return {
        "sucesso": True,
        "billing": {k: v for k, v in reg.items() if k != "historico"},
        "historico": sorted(historico.values(), key=lambda e: e.get("timestamp", 0), reverse=True),
    }


@router.post("/processar-tolerancias")
def processar_tolerancias(usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Suspende assinaturas cuja tolerância expirou. Chamado por cron/Studio."""
    if not usuario.admin_global:
        raise HTTPException(status_code=403, detail="Acesso restrito.")
    agora = int(time.time() * 1000)
    billing = db.get("billing") or {}
    suspensos = []
    for uid, reg in billing.items():
        if reg.get("status") == "em_tolerancia" and reg.get("toleranciaAte") and reg["toleranciaAte"] < agora:
            _aplicar_plano(uid, reg.get("planoAtual", "free"), "suspensa")
            db.update(f"billing/{uid}", {"status": "suspensa"})
            _registrar_historico(uid, {"evento": "tolerancia_expirada"})
            suspensos.append(uid)
    return {"sucesso": True, "suspensos": suspensos}
