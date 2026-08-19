"""Systematrix TNE — Backend FastAPI."""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .core.auth import UsuarioAtual, get_usuario_atual
from .core.permissions import sistemas_visiveis
from .routes import academico, admin_global, billing, engines, modulos, projetos, tenants

app = FastAPI(title="Systematrix TNE API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(engines.router)
app.include_router(projetos.router)
app.include_router(tenants.router)
app.include_router(academico.router)
app.include_router(modulos.router)
app.include_router(billing.router)
app.include_router(admin_global.router)


@app.on_event("startup")
def startup():
    try:
        db.init_firebase()
    except Exception as exc:
        print(f"Firebase indisponível no startup: {exc}")


@app.get("/health")
def health():
    return {"sucesso": True, "firebase": db.firebase_ready()}


@app.get("/config/publica")
def config_publica():
    """Configurações públicas lidas pelo frontend (manutenção, tolerância)."""
    return {
        "manutencao": bool(db.get("config/manutencao")),
        "toleranciaDias": int(db.get("config/toleranciaDias") or config.DEFAULT_TOLERANCIA_DIAS),
    }


@app.get("/me")
def me(usuario: UsuarioAtual = Depends(get_usuario_atual)):
    vinculos = {}
    for tenant_id, v in (usuario.vinculos or {}).items():
        cargo = db.get(f"tenants/{tenant_id}/cargos/{v.get('cargo')}") or {}
        contrato = db.get(f"tenants/{tenant_id}/contrato") or {}
        info = db.get(f"tenants/{tenant_id}/info") or {}
        vinculos[tenant_id] = {
            **v,
            "instituicao": info.get("nome"),
            "sistemasVisiveis": sistemas_visiveis(cargo, contrato.get("sistemas", [])),
        }
    tipo = (usuario.plano or {}).get("tipo", "free")
    from .core import plans
    return {
        "sucesso": True,
        "uid": usuario.uid,
        "nome": usuario.nome,
        "email": usuario.email,
        "adminGlobal": usuario.admin_global,
        "plano": {**(usuario.plano or {}), "sistemas": plans.get_plano(tipo)["sistemas"]},
        "vinculos": vinculos,
    }
