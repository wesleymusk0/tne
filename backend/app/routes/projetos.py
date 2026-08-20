"""Ciclo de vida dos Projetos — entidades distintas por sistema (TNE §12).

CRIAR um projeto é o ato que consome as regras institucionais e os limites
de plano (TNE §13). Gerar múltiplas versões dentro do mesmo projeto NÃO
consome nova contagem.

Escopo:
  - institucional → tenants/{tid}/projetos/{sistema}/{projetoId}
  - individual    → users/{uid}/projetos/{sistema}/{projetoId}
"""
import time

from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import plans, rules
from app.core.access import checar_contexto as _checar_contexto
from app.core.auth import UsuarioAtual, get_usuario_atual

router = APIRouter(prefix="/projetos", tags=["projetos"])


def _base_path(usuario: UsuarioAtual, tenant_id: str | None):
    if tenant_id:
        return f"tenants/{tenant_id}/projetos", True
    return f"users/{usuario.uid}/projetos", False


def _contar_no_periodo(base, sistema, periodo):
    ini, fim = rules.janela_periodo(periodo)
    projetos = db.get(f"{base}/{sistema}") or {}
    count = 0
    for p in projetos.values():
        criado = p.get("criadoEm", 0)
        if criado >= ini and (fim is None or criado < fim):
            count += 1
    return count


@router.post("/{sistema}")
def criar_projeto(sistema: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    sistema = sistema.lower()
    if sistema not in plans.SISTEMAS:
        raise HTTPException(status_code=404, detail="Sistema desconhecido.")

    tenant_id = body.get("tenantId")
    ctx = _checar_contexto(usuario, tenant_id, sistema, acao="criar")
    base, _ = _base_path(usuario, tenant_id)

    # Limites de contagem do FREE (triagens, simulações, correções).
    chave_contador = {"avalia": "max_triagens", "tri": "max_simulacoes", "somatoria": "max_correcoes"}.get(sistema)

    if ctx["tipo"] == "individual":
        tipo = ctx["plano"]
        if chave_contador:
            atual = int(db.get(f"usage/{usuario.uid}/{sistema}/total") or 0)
            ok, msg = plans.verificar_limite(tipo, sistema, chave_contador, atual)
            if not ok:
                raise HTTPException(status_code=403, detail=msg)
    else:
        # Regras institucionais: interpretação literal por período.
        regras = db.get(f"tenants/{tenant_id}/regras") or {}
        for regra_id, regra in regras.items():
            if not regra.get("ativa", True):
                continue
            if (regra.get("sistema") or "").lower() != sistema:
                continue
            atual = _contar_no_periodo(base, sistema, regra.get("periodo", "total"))
            ok, msg = rules.verificar_regra(regra, atual)
            if not ok:
                raise HTTPException(status_code=409, detail=msg)

    projeto = {
        "tipo": sistema,
        "nome": body.get("nome") or f"Projeto de {sistema}",
        "status": "ativo",
        "criadoPor": usuario.uid,
        "criadoEm": int(time.time() * 1000),
        "dados": body.get("dados") or {},
    }
    ref = db.tenant_push(tenant_id, "projetos", sistema, projeto) if tenant_id else db.push(f"{base}/{sistema}", projeto)
    projeto_id = ref.key

    if ctx["tipo"] == "individual" and chave_contador:
        db.set_value(f"usage/{usuario.uid}/{sistema}/total", atual + 1)

    return {"sucesso": True, "projetoId": projeto_id, "projeto": projeto}


@router.get("/{sistema}")
def listar_projetos(sistema: str, tenantId: str | None = None, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    sistema = sistema.lower()
    base, _ = _base_path(usuario, tenantId)
    if tenantId:
        _checar_contexto(usuario, tenantId, sistema, acao="visualizar")
    projetos = db.get(f"{base}/{sistema}") or {}
    lista = [{"id": pid, **p} for pid, p in projetos.items()]
    lista.sort(key=lambda p: p.get("criadoEm", 0), reverse=True)
    return {"sucesso": True, "projetos": lista}


@router.get("/{sistema}/{projeto_id}")
def obter_projeto(sistema: str, projeto_id: str, tenantId: str | None = None, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    base, _ = _base_path(usuario, tenantId)
    projeto = db.get(f"{base}/{sistema.lower()}/{projeto_id}")
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    return {"sucesso": True, "projeto": projeto}


@router.put("/{sistema}/{projeto_id}")
def salvar_projeto(sistema: str, projeto_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    base, _ = _base_path(usuario, body.get("tenantId"))
    path = f"{base}/{sistema.lower()}/{projeto_id}"
    if not db.get(path):
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    dados = body.get("dados")
    if dados is not None:
        db.update(path, {"dados": dados, "atualizadoEm": int(time.time() * 1000)})
    if body.get("nome"):
        db.update(path, {"nome": body["nome"]})
    if body.get("status"):
        db.update(path, {"status": body["status"]})
    return {"sucesso": True}
