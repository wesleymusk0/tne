"""Auditoria — registro de ações administrativas (TNE §44).

Registra: usuário, ação, data/hora, contexto, instituição, resultado, origem.
Logs globais em global/audit; logs institucionais em tenants/{id}/audit.
"""
import time


def registrar(db, *, uid, acao, resultado="sucesso", tenant_id=None, contexto=None, origem=None):
    registro = {
        "usuario": uid,
        "acao": acao,
        "resultado": resultado,
        "timestamp": int(time.time() * 1000),
        "contexto": contexto or {},
        "origem": origem or "backend",
    }
    if tenant_id:
        registro["instituicao"] = tenant_id
        db.push(f"tenants/{tenant_id}/audit", registro)
    db.push("global/audit", registro)
    return registro
