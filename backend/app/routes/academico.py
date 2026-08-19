"""Gestão acadêmica centralizada — turmas, alunos, presença, notas, boletim.

Os dados são a fonte única consumida por MapIA, Notas, Presença, BuscIA,
DomicilIA e demais sistemas (TNE §11, §22).
"""
import time

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..core.access import checar_contexto
from ..core.auth import UsuarioAtual, get_usuario_atual
from ..core.permissions import tem_permissao

router = APIRouter(prefix="/academico", tags=["academico"])

CAMPOS_ALUNO = [
    "nome", "genero", "matricula", "status", "turno", "anoLetivo", "numeroChamada",
    "cgm", "rg", "cpf", "email", "turmaId",
    "altura", "cadeirante", "oculos", "defVisual", "defAuditiva", "defMotora",
    "defIntelectual", "autismo", "tdah", "dislexia", "discalculia", "disgrafia",
    "multiplasNecessidades", "outrasNecessidades", "pei", "adaptacao",
    "responsavel",
]

ESTADOS_PRESENCA = {"C", "F", "A"}


def _cargo(usuario: UsuarioAtual, tenant_id: str):
    vinculo = (usuario.vinculos or {}).get(tenant_id)
    if not vinculo or vinculo.get("status", "ativo") != "ativo":
        raise HTTPException(status_code=403, detail="Usuário sem vínculo ativo com esta instituição.")
    return db.get(f"tenants/{tenant_id}/cargos/{vinculo.get('cargo')}") or {}


def _exigir(usuario, tenant_id, sistema, acao):
    cargo = _cargo(usuario, tenant_id)
    if not tem_permissao(cargo, sistema, acao):
        raise HTTPException(status_code=403, detail=f"Seu cargo não permite '{acao}' em {sistema}.")
    return cargo


# --- Turmas -------------------------------------------------------------------
@router.post("/{tenant_id}/turmas")
def criar_turma(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    cargo = _cargo(usuario, tenant_id)
    if not (tem_permissao(cargo, "presenca", "gerenciar") or tem_permissao(cargo, "_instituicao", "gerenciar")
            or tem_permissao(cargo, "_instituicao", "criar") or tem_permissao(cargo, "_instituicao", "editar")):
        raise HTTPException(status_code=403, detail="Sem permissão para gerenciar turmas.")
    nome = (body.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da turma é obrigatório.")
    turma = {
        "nome": nome,
        "anoLetivo": body.get("anoLetivo"),
        "turno": body.get("turno"),
        "criadoEm": int(time.time() * 1000),
    }
    ref = db.tenant_push(tenant_id, "turmas", turma)
    return {"sucesso": True, "turmaId": ref.key, "turma": turma}


@router.get("/{tenant_id}/turmas")
def listar_turmas(tenant_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _cargo(usuario, tenant_id)
    turmas = db.tenant_get(tenant_id, "turmas") or {}
    return {"sucesso": True, "turmas": [{"id": k, **v} for k, v in turmas.items()]}


@router.delete("/{tenant_id}/turmas/{turma_id}")
def excluir_turma(tenant_id: str, turma_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    cargo = _cargo(usuario, tenant_id)
    if not tem_permissao(cargo, "_instituicao", "excluir"):
        raise HTTPException(status_code=403, detail="Sem permissão para excluir turmas.")
    alunos = db.tenant_get(tenant_id, "alunos") or {}
    if any(a.get("turmaId") == turma_id for a in alunos.values()):
        raise HTTPException(status_code=409, detail="Turma possui alunos. Remaneje-os antes de excluir.")
    db.delete(db.tenant_path(tenant_id, "turmas", turma_id))
    return {"sucesso": True}


# --- Alunos -------------------------------------------------------------------
@router.post("/{tenant_id}/alunos")
def cadastrar_aluno(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    cargo = _cargo(usuario, tenant_id)
    if not (tem_permissao(cargo, "_instituicao", "criar") or tem_permissao(cargo, "_instituicao", "gerenciar")):
        raise HTTPException(status_code=403, detail="Sem permissão para cadastrar alunos.")
    if not (body.get("nome") or "").strip():
        raise HTTPException(status_code=400, detail="Nome do aluno é obrigatório.")
    turma_id = body.get("turmaId")
    if turma_id and not db.tenant_get(tenant_id, "turmas", turma_id):
        raise HTTPException(status_code=404, detail="Turma não encontrada.")
    aluno = {campo: body[campo] for campo in CAMPOS_ALUNO if campo in body}
    aluno["status"] = aluno.get("status") or "ativo"
    aluno["criadoEm"] = int(time.time() * 1000)
    ref = db.tenant_push(tenant_id, "alunos", aluno)
    return {"sucesso": True, "alunoId": ref.key, "aluno": aluno}


@router.get("/{tenant_id}/alunos")
def listar_alunos(tenant_id: str, turmaId: str | None = None, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _cargo(usuario, tenant_id)
    alunos = db.tenant_get(tenant_id, "alunos") or {}
    lista = [{"id": k, **v} for k, v in alunos.items()]
    if turmaId:
        lista = [a for a in lista if a.get("turmaId") == turmaId]
    lista.sort(key=lambda a: (a.get("numeroChamada") or 9999, a.get("nome") or ""))
    return {"sucesso": True, "alunos": lista}


@router.put("/{tenant_id}/alunos/{aluno_id}")
def atualizar_aluno(tenant_id: str, aluno_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    cargo = _cargo(usuario, tenant_id)
    if not (tem_permissao(cargo, "_instituicao", "editar") or tem_permissao(cargo, "_instituicao", "gerenciar")):
        raise HTTPException(status_code=403, detail="Sem permissão para editar alunos.")
    path = db.tenant_path(tenant_id, "alunos", aluno_id)
    if not db.get(path):
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    atualizacao = {campo: body[campo] for campo in CAMPOS_ALUNO if campo in body}
    if atualizacao:
        db.update(path, atualizacao)
    return {"sucesso": True}


@router.delete("/{tenant_id}/alunos/{aluno_id}")
def excluir_aluno(tenant_id: str, aluno_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    cargo = _cargo(usuario, tenant_id)
    if not tem_permissao(cargo, "_instituicao", "excluir"):
        raise HTTPException(status_code=403, detail="Sem permissão para excluir alunos.")
    db.delete(db.tenant_path(tenant_id, "alunos", aluno_id))
    return {"sucesso": True}


# --- Presença -------------------------------------------------------------------
@router.put("/{tenant_id}/presenca/{data}/{turma_id}")
def registrar_presenca(tenant_id: str, data: str, turma_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Registra presença de uma turma em um dia. Estados: C, F, A(+atrasoMinutos)."""
    _exigir(usuario, tenant_id, "presenca", "criar")
    registros = body.get("registros") or {}
    if not registros:
        raise HTTPException(status_code=400, detail="Nenhum registro informado.")
    alunos = db.tenant_get(tenant_id, "alunos") or {}
    gravados = {}
    for aluno_id, reg in registros.items():
        if aluno_id not in alunos:
            continue
        estado = (reg.get("estado") or "").upper()
        if estado not in ESTADOS_PRESENCA:
            raise HTTPException(status_code=400, detail=f"Estado inválido para {aluno_id}: use C, F ou A.")
        entrada = {"estado": estado, "registradoPor": usuario.uid, "timestamp": int(time.time() * 1000)}
        if estado == "A":
            entrada["atrasoMinutos"] = reg.get("atrasoMinutos")
        gravados[aluno_id] = entrada
    db.tenant_set(tenant_id, "presenca", data, turma_id, gravados)
    return {"sucesso": True, "registrados": len(gravados)}


@router.get("/{tenant_id}/presenca")
def consultar_presenca(tenant_id: str, data: str | None = None, turmaId: str | None = None,
                       usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "presenca", "visualizar")
    if data and turmaId:
        return {"sucesso": True, "presenca": db.tenant_get(tenant_id, "presenca", data, turmaId) or {}}
    if data:
        return {"sucesso": True, "presenca": db.tenant_get(tenant_id, "presenca", data) or {}}
    return {"sucesso": True, "presenca": db.tenant_get(tenant_id, "presenca") or {}}


# --- Configuração de avaliação (sistemas de notas) ------------------------------
@router.put("/{tenant_id}/config-avaliacao")
def configurar_avaliacao(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Configura o sistema de avaliação da instituição (TNE §23).

    Ex.: {"escala": "0-100", "componentes": [{"id": "AV1", "nome": "Avaliação 1", "pontos": 20}, ...],
          "media": "aritmetica"}
    """
    cargo = _cargo(usuario, tenant_id)
    if not tem_permissao(cargo, "_instituicao", "gerenciar"):
        raise HTTPException(status_code=403, detail="Sem permissão para configurar avaliações.")
    componentes = body.get("componentes") or []
    for c in componentes:
        if not c.get("id") or not c.get("nome") or not isinstance(c.get("pontos"), (int, float)):
            raise HTTPException(status_code=400, detail="Cada componente precisa de id, nome e pontos.")
    config = {
        "escala": body.get("escala", "0-100"),
        "componentes": componentes,
        "media": body.get("media", "aritmetica"),
        "atualizadoEm": int(time.time() * 1000),
    }
    db.tenant_set(tenant_id, "configAvaliacao", config)
    return {"sucesso": True, "config": config}


def calcular_total(notas_componentes: dict, componentes: list, media: str = "aritmetica") -> float:
    """Soma os pontos dos componentes lançados (cada um já na sua escala)."""
    total = 0.0
    for c in componentes:
        valor = notas_componentes.get(c["id"])
        if valor is None:
            continue
        total += float(valor)
    return round(total, 1)


# --- Notas -------------------------------------------------------------------
@router.put("/{tenant_id}/notas/{periodo}/{turma_id}/{disciplina}/{aluno_id}")
def lancar_notas(tenant_id: str, periodo: str, turma_id: str, disciplina: str, aluno_id: str,
                 body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "notas", "criar")
    config = db.tenant_get(tenant_id, "configAvaliacao") or {}
    componentes = config.get("componentes") or []
    validos = {c["id"] for c in componentes}
    componentes_notas = body.get("componentes") or {}
    for comp_id, valor in componentes_notas.items():
        if validos and comp_id not in validos:
            raise HTTPException(status_code=400, detail=f"Componente desconhecido: {comp_id}")
        if not isinstance(valor, (int, float)):
            raise HTTPException(status_code=400, detail=f"Nota inválida em {comp_id}.")
    total = calcular_total(componentes_notas, componentes, config.get("media", "aritmetica"))
    registro = {
        "componentes": componentes_notas,
        "total": total,
        "atualizadoPor": usuario.uid,
        "atualizadoEm": int(time.time() * 1000),
    }
    db.tenant_set(tenant_id, "notas", periodo, turma_id, disciplina, aluno_id, registro)
    return {"sucesso": True, "total": total}


@router.get("/{tenant_id}/notas/{periodo}/{turma_id}/{disciplina}")
def notas_turma_disciplina(tenant_id: str, periodo: str, turma_id: str, disciplina: str,
                           usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "notas", "visualizar")
    return {"sucesso": True, "notas": db.tenant_get(tenant_id, "notas", periodo, turma_id, disciplina) or {}}


# --- Boletim -------------------------------------------------------------------
@router.get("/{tenant_id}/boletim/{periodo}/{aluno_id}")
def emitir_boletim(tenant_id: str, periodo: str, aluno_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "notas", "emitir")
    aluno = db.tenant_get(tenant_id, "alunos", aluno_id)
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    turma_id = aluno.get("turmaId")
    disciplinas = db.tenant_get(tenant_id, "notas", periodo, turma_id) or {} if turma_id else {}
    linhas = []
    for disciplina, alunos_notas in disciplinas.items():
        registro = (alunos_notas or {}).get(aluno_id)
        if registro:
            linhas.append({"disciplina": disciplina, "componentes": registro.get("componentes", {}), "total": registro.get("total")})
    config = db.tenant_get(tenant_id, "configAvaliacao") or {}
    info = db.tenant_get(tenant_id, "info") or {}
    return {
        "sucesso": True,
        "boletim": {
            "instituicao": info.get("nome"),
            "personalizacao": db.tenant_get(tenant_id, "personalizacao") or {},
            "aluno": {"id": aluno_id, "nome": aluno.get("nome"), "matricula": aluno.get("matricula")},
            "periodo": periodo,
            "config": config,
            "linhas": linhas,
            "emitidoPor": usuario.uid,
            "emitidoEm": int(time.time() * 1000),
        },
    }
