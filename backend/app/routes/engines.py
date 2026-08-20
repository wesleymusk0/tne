"""Rotas dos engines — mesma entrada/saída da API legada, agora com
verificação de ID token (obrigatória) e enforcement de plano/permissões.
"""
import time

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..core import plans
from ..core.access import checar_contexto
from ..core.auth import UsuarioAtual, get_usuario_atual
from ..engines import avalia, horia, mapia, remanejia, somatoria, tri

router = APIRouter(prefix="/engines", tags=["engines"])


def _ctx(usuario, data, sistema, acao="criar"):
    return checar_contexto(usuario, data.get("tenantId"), sistema, acao)


@router.post("/mapia/gerar")
def gerar_mapia(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    ctx = _ctx(usuario, data, "mapia")
    if ctx["tipo"] == "individual":
        ok, msg = plans.verificar_tamanho_maximo(ctx["plano"], "mapia", "max_alunos_por_mapa", len(data.get("students", [])))
        if not ok:
            raise HTTPException(status_code=403, detail=msg)
    return mapia.gerar_mapa(data)


@router.post("/remanejia/gerar")
def gerar_remanejia(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _ctx(usuario, data, "remanejia")
    students = data.get("students", [])
    if not students:
        raise HTTPException(status_code=400, detail="Sem alunos.")
    mix = data.get("mixPercentage")
    if mix is not None and int(mix) < 100:
        livres, fixos = remanejia.aplicar_percentual_mistura(students, int(mix))
        resultado = remanejia.gerar_enturmacao({**data, "students": livres})
        if not resultado.get("sucesso"):
            return resultado
        resultado["fixos"] = fixos
        return resultado
    return remanejia.gerar_enturmacao(data)


@router.post("/avalia/gerar")
def gerar_avalia(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _ctx(usuario, data, "avalia")
    return avalia.gerar_triagem(data)


@router.post("/somatoria/calcular")
def somatoria_calcular(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _ctx(usuario, data, "somatoria")
    return somatoria.calcular_notas(data)


@router.post("/tri/analise")
def analise_tri(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _ctx(usuario, data, "tri")
    return tri.analise_tri(data)


def _horario(data: dict, modo: str, usuario: UsuarioAtual):
    if not data:
        raise HTTPException(status_code=400, detail="Dados inválidos")
    _ctx(usuario, data, "horia")
    inicio = time.time()
    resultado = horia.executar_logica_horario(data, modo=modo)
    if resultado.get("sucesso"):
        resultado["mensagem"] += f"\n(Tempo: {time.time() - inicio:.2f}s)"
    return resultado


@router.post("/horia/gerar")
def gerar_horario(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    return _horario(data, "gerar_padrao", usuario)


@router.post("/horia/otimizar_janelas")
def otimizar_janelas(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    return _horario(data, "otimizar_janelas", usuario)


@router.post("/horia/balancear_carga")
def balancear_carga(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    return _horario(data, "balancear_carga", usuario)


@router.post("/horia/alocar_ha")
def alocar_ha(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    return _horario(data, "alocar_ha", usuario)


@router.post("/horia/otimizar_dias")
def otimizar_dias(data: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    return _horario(data, "reduzir_dias", usuario)
