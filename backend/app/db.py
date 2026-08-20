"""Inicialização do Firebase Admin e acesso ao Realtime Database.

Todo acesso a dados passa por aqui e é SEMPRE escopado por tenant quando o
dado é institucional. Nenhum módulo deve chamar firebase_admin.db diretamente.
"""
import firebase_admin
from firebase_admin import credentials, db

from app import config

_app = None


def init_firebase():
    global _app
    if firebase_admin._apps:
        _app = firebase_admin.get_app()
        return _app
    cred = credentials.Certificate(config.FIREBASE_CRED_PATH)
    _app = firebase_admin.initialize_app(cred, {"databaseURL": config.FIREBASE_DB_URL})
    return _app


def firebase_ready():
    return bool(firebase_admin._apps)


def ref(path):
    if not firebase_admin._apps:
        init_firebase()
    return db.reference(path)


def get(path):
    return ref(path).get()


def set_value(path, value):
    ref(path).set(value)


def update(path, value):
    ref(path).update(value)


def push(path, value):
    return ref(path).push(value)


def delete(path):
    ref(path).delete()


# --- Escopo de tenant -------------------------------------------------------
def tenant_path(tenant_id, *partes):
    if not tenant_id:
        raise ValueError("tenant_id é obrigatório para dados institucionais.")
    return "/".join(["tenants", tenant_id, *[str(p).strip("/") for p in partes]])


def tenant_get(tenant_id, *partes):
    return get(tenant_path(tenant_id, *partes))


def tenant_set(tenant_id, *partes_e_valor):
    *partes, valor = partes_e_valor
    set_value(tenant_path(tenant_id, *partes), valor)


def tenant_update(tenant_id, *partes_e_valor):
    *partes, valor = partes_e_valor
    update(tenant_path(tenant_id, *partes), valor)


def tenant_push(tenant_id, *partes_e_valor):
    *partes, valor = partes_e_valor
    return push(tenant_path(tenant_id, *partes), valor)
