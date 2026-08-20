"""BuscIA, DomicilIA, Dashboard e Systematrix Studio."""
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app import config, db
from app.core import audit, plans
from app.core.access import checar_contexto
from app.core.auth import UsuarioAtual, get_usuario_atual
from app.core.permissions import tem_permissao

router = APIRouter(tags=["modulos"])


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


def _enviar_email(para, assunto, html):
    if not config.RESEND_API_KEY:
        return {"enviado": False, "motivo": "Resend não configurado."}
    resp = httpx.post("https://api.resend.com/emails", json={
        "from": config.EMAIL_FROM, "to": [para], "subject": assunto, "html": html,
    }, headers={"Authorization": f"Bearer {config.RESEND_API_KEY}"}, timeout=30)
    return {"enviado": resp.status_code < 400, "status": resp.status_code}


# ============================ BuscIA (TNE §20) ================================
@router.get("/buscia/{tenant_id}/alunos-busca")
def buscia_dados_alunos(tenant_id: str, turmaId: str, numeros: str | None = None,
                        usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Dados para a extensão BuscIA: nome, responsável e telefone por nº de chamada.

    numeros: lista separada por vírgula; se omitido, retorna a turma inteira.
    """
    _exigir(usuario, tenant_id, "buscia", "visualizar")
    alunos = db.tenant_get(tenant_id, "alunos") or {}
    info = db.tenant_get(tenant_id, "info") or {}
    selecionados = []
    numeros_set = {n.strip() for n in numeros.split(",")} if numeros else None
    for aluno_id, a in alunos.items():
        if a.get("turmaId") != turmaId:
            continue
        if numeros_set is not None and str(a.get("numeroChamada")) not in numeros_set:
            continue
        resp = a.get("responsavel") or {}
        selecionados.append({
            "alunoId": aluno_id,
            "nome": a.get("nome"),
            "numeroChamada": a.get("numeroChamada"),
            "responsavel": resp.get("nome"),
            "telefoneResponsavel": resp.get("telefone"),
            "preferenciaContato": resp.get("preferenciaContato"),
        })
    selecionados.sort(key=lambda a: (a.get("numeroChamada") or 9999))
    return {"sucesso": True, "instituicao": info.get("nome"), "alunos": selecionados}


@router.post("/buscia/{tenant_id}/mensagens")
def buscia_registrar_mensagens(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Registra o lote de mensagens enviadas pela extensão (log + limite FREE).

    A mensagem final é montada no cliente com campos dinâmicos
    ([RESPONSÁVEL], [INSTITUIÇÃO], [ALUNO], [DATA], [TEMPO]); aqui registramos
    destinatário, tipo (falta/atraso) e conteúdo para auditoria.
    """
    _exigir(usuario, tenant_id, "buscia", "criar")
    mensagens = body.get("mensagens") or []
    if not mensagens:
        raise HTTPException(status_code=400, detail="Nenhuma mensagem informada.")

    semana = plans.semana_atual()
    chave_uso = f"usage/{usuario.uid}/buscia/{semana}"
    uso_atual = int(db.get(chave_uso) or 0)
    ok, msg = plans.verificar_limite((usuario.plano or {}).get("tipo", "free"),
                                     "buscia", "max_mensagens_semana", uso_atual)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)

    registros = []
    for m in mensagens:
        for campo in ("alunoId", "tipo", "conteudo"):
            if not m.get(campo):
                raise HTTPException(status_code=400, detail=f"Mensagem sem '{campo}'.")
        registros.append({**m, "enviadoPor": usuario.uid, "timestamp": int(time.time() * 1000)})
    db.tenant_push(tenant_id, "buscia", "lotes", {
        "mensagens": registros, "enviadoPor": usuario.uid, "timestamp": int(time.time() * 1000),
    })
    db.set_value(chave_uso, uso_atual + len(registros))
    return {"sucesso": True, "registradas": len(registros), "usoSemana": uso_atual + len(registros)}


# ============================ DomicilIA (TNE §21) =============================
@router.put("/domicilia/{tenant_id}/config")
def domicilia_config(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "domicilia", "gerenciar")
    ficha = body.get("ficha")
    if ficha not in ("padrao", "opcional", "ausente"):
        raise HTTPException(status_code=400, detail="Ficha deve ser: padrao, opcional ou ausente.")
    intervalo = body.get("lembreteIntervaloDias", 15)
    if not isinstance(intervalo, int) or intervalo < 1:
        raise HTTPException(status_code=400, detail="Intervalo de lembrete deve ser inteiro >= 1.")
    cfg = {
        "ficha": ficha,
        "enviarPorEmail": bool(body.get("enviarPorEmail")),
        "manterNoSistema": body.get("manterNoSistema", True),
        "permitirImpressao": body.get("permitirImpressao", True),
        "lembreteIntervaloDias": intervalo,
        "atualizadoEm": int(time.time() * 1000),
    }
    db.tenant_set(tenant_id, "domicilia", "config", cfg)
    return {"sucesso": True, "config": cfg}


@router.post("/domicilia/{tenant_id}/atividades")
def domicilia_criar_atividade(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "domicilia", "criar")
    if not db.tenant_get(tenant_id, "alunos", body.get("alunoId") or ""):
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    cfg = db.tenant_get(tenant_id, "domicilia", "config") or {}
    atividade = {
        "alunoId": body["alunoId"],
        "turmaId": body.get("turmaId"),
        "instrucoes": body.get("instrucoes", ""),
        "fichaInstrucional": body.get("fichaInstrucional"),
        "anexos": body.get("anexos") or [],
        "status": "pendente",
        "criadoPor": usuario.uid,
        "criadoEm": int(time.time() * 1000),
        "ultimoLembreteEm": None,
    }
    if cfg.get("ficha") == "padrao" and not atividade["fichaInstrucional"]:
        raise HTTPException(status_code=400, detail="A instituição exige ficha instrucional padrão.")
    if cfg.get("ficha") == "ausente" and atividade["fichaInstrucional"]:
        atividade["fichaInstrucional"] = None
    ref = db.tenant_push(tenant_id, "domicilia", "atividades", atividade)
    return {"sucesso": True, "atividadeId": ref.key}


@router.get("/domicilia/{tenant_id}/atividades")
def domicilia_listar(tenant_id: str, turmaId: str | None = None, alunoId: str | None = None,
                     status: str | None = None, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "domicilia", "visualizar")
    atividades = db.tenant_get(tenant_id, "domicilia", "atividades") or {}
    lista = [{"id": k, **v} for k, v in atividades.items()]
    if turmaId:
        lista = [a for a in lista if a.get("turmaId") == turmaId]
    if alunoId:
        lista = [a for a in lista if a.get("alunoId") == alunoId]
    if status:
        lista = [a for a in lista if a.get("status") == status]
    lista.sort(key=lambda a: a.get("criadoEm", 0), reverse=True)
    return {"sucesso": True, "atividades": lista, "config": db.tenant_get(tenant_id, "domicilia", "config") or {}}


@router.post("/domicilia/{tenant_id}/atividades/{atividade_id}/enviar")
def domicilia_enviar(tenant_id: str, atividade_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Marca como enviada e dispara e-mail ao responsável, se configurado."""
    _exigir(usuario, tenant_id, "domicilia", "editar")
    path = db.tenant_path(tenant_id, "domicilia", "atividades", atividade_id)
    atividade = db.get(path)
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    cfg = db.tenant_get(tenant_id, "domicilia", "config") or {}
    resultado_email = {"enviado": False, "motivo": "Envio por e-mail desativado pela instituição."}
    if cfg.get("enviarPorEmail"):
        aluno = db.tenant_get(tenant_id, "alunos", atividade["alunoId"]) or {}
        email_resp = (aluno.get("responsavel") or {}).get("email")
        if email_resp:
            info = db.tenant_get(tenant_id, "info") or {}
            resultado_email = _enviar_email(
                email_resp, f"[{info.get('nome', 'Escola')}] Atividade domiciliar de {aluno.get('nome')}",
                f"<p>Olá, {(aluno.get('responsavel') or {}).get('nome', 'responsável')}.</p>"
                f"<p>Segue a atividade domiciliar de <strong>{aluno.get('nome')}</strong>:</p>"
                f"<p>{atividade.get('instrucoes', '')}</p>")
    db.update(path, {"status": "enviada", "enviadaEm": int(time.time() * 1000)})
    return {"sucesso": True, "email": resultado_email}


@router.post("/domicilia/{tenant_id}/lembretes")
def domicilia_lembretes(tenant_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Lembra professores de atividades pendentes além do intervalo configurado."""
    _exigir(usuario, tenant_id, "domicilia", "visualizar")
    cfg = db.tenant_get(tenant_id, "domicilia", "config") or {}
    intervalo_ms = int(cfg.get("lembreteIntervaloDias", 15)) * 86400 * 1000
    agora = int(time.time() * 1000)
    atividades = db.tenant_get(tenant_id, "domicilia", "atividades") or {}
    lembrados = []
    for aid, a in atividades.items():
        if a.get("status") != "pendente":
            continue
        ultimo = a.get("ultimoLembreteEm") or a.get("criadoEm", 0)
        if agora - ultimo < intervalo_ms:
            continue
        criador = a.get("criadoPor")
        email_prof = (db.get(f"users/{criador}") or {}).get("email") if criador else None
        if email_prof:
            aluno = db.tenant_get(tenant_id, "alunos", a.get("alunoId")) or {}
            _enviar_email(email_prof, "Lembrete: atividade domiciliar pendente",
                          f"<p>Há uma atividade domiciliar pendente para <strong>{aluno.get('nome')}</strong>.</p>")
        db.update(db.tenant_path(tenant_id, "domicilia", "atividades", aid), {"ultimoLembreteEm": agora})
        lembrados.append(aid)
    return {"sucesso": True, "lembretesEnviados": len(lembrados)}


# ============================ Dashboard (TNE §9, §39) =========================
@router.get("/dashboard/{tenant_id}")
def dashboard(tenant_id: str, inicio: int | None = None, fim: int | None = None,
              usuario: UsuarioAtual = Depends(get_usuario_atual)):
    """Indicadores institucionais por período (dia/semana/mês/período/ano letivo).

    O conteúdo respeita as permissões do cargo do usuário.
    """
    cargo = _cargo(usuario, tenant_id)
    dados = db.get(f"tenants/{tenant_id}") or {}
    alunos = dados.get("alunos") or {}
    presenca = dados.get("presenca") or {}
    atividades = (dados.get("domicilia") or {}).get("atividades") or {}

    def no_periodo(ts):
        if inicio and ts < inicio:
            return False
        if fim and ts > fim:
            return False
        return True

    resumo = {
        "alunos": len(alunos),
        "turmas": len(dados.get("turmas") or {}),
        "professores": len([u for u in (db.get("users") or {}).values()
                            if tenant_id in (u.get("vinculos") or {})]),
    }

    indicadores = {}
    if tem_permissao(cargo, "presenca", "visualizar"):
        c = f = a = 0
        por_dia = {}
        for data, turmas_dia in presenca.items():
            for turma_id, registros in (turmas_dia or {}).items():
                for aluno_id, reg in (registros or {}).items():
                    ts = reg.get("timestamp", 0)
                    if not no_periodo(ts):
                        continue
                    estado = reg.get("estado")
                    if estado == "C":
                        c += 1
                    elif estado == "F":
                        f += 1
                    elif estado == "A":
                        a += 1
                    por_dia[data] = por_dia.get(data, 0) + 1
        indicadores["presenca"] = {"compareceram": c, "faltas": f, "atrasos": a, "porDia": por_dia}
    if tem_permissao(cargo, "domicilia", "visualizar"):
        pendentes = [x for x in atividades.values() if x.get("status") == "pendente"]
        indicadores["domicilia"] = {"pendentes": len(pendentes), "total": len(atividades)}
    if tem_permissao(cargo, "notas", "visualizar"):
        notas = dados.get("notas") or {}
        totais = []
        for periodo, turmas_p in notas.items():
            for turma_id, disciplinas in (turmas_p or {}).items():
                for disc, alunos_n in (disciplinas or {}).items():
                    for aluno_id, reg in (alunos_n or {}).items():
                        if reg.get("total") is not None:
                            totais.append(reg["total"])
        if totais:
            indicadores["notas"] = {"mediaGeral": round(sum(totais) / len(totais), 1), "lancamentos": len(totais)}
    return {"sucesso": True, "resumo": resumo, "indicadores": indicadores}


# ============================ Systematrix Studio (TNE §26) ====================
# Registro extensível de ações. Apenas ações exigidas pela especificação estão
# implementadas; novas ações são adicionadas registrando novos handlers.
ACOES_STUDIO = {}


def acao_studio(tipo):
    def deco(fn):
        ACOES_STUDIO[tipo] = fn
        return fn
    return deco


@acao_studio("lembrete_domicilia")
def _acao_lembrete_domicilia(tenant_id, params):
    cfg = db.tenant_get(tenant_id, "domicilia", "config") or {}
    intervalo_ms = int(cfg.get("lembreteIntervaloDias", 15)) * 86400 * 1000
    agora = int(time.time() * 1000)
    atividades = db.tenant_get(tenant_id, "domicilia", "atividades") or {}
    pendentes = [a for a in atividades.values()
                 if a.get("status") == "pendente" and agora - (a.get("ultimoLembreteEm") or a.get("criadoEm", 0)) >= intervalo_ms]
    return {"pendentesEncontradas": len(pendentes)}


@acao_studio("processar_tolerancias")
def _acao_processar_tolerancias(tenant_id, params):
    agora = int(time.time() * 1000)
    billing = db.get("billing") or {}
    expiradas = [uid for uid, b in billing.items()
                 if b.get("status") == "em_tolerancia" and b.get("toleranciaAte") and b["toleranciaAte"] < agora]
    return {"toleranciasExpiradas": len(expiradas)}


@router.post("/studio/{tenant_id}/automacoes")
def studio_criar(tenant_id: str, body: dict, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "_instituicao", "gerenciar")
    tipo = body.get("acao", {}).get("tipo")
    if tipo not in ACOES_STUDIO:
        raise HTTPException(status_code=400, detail=f"Ação desconhecida. Disponíveis: {sorted(ACOES_STUDIO)}")
    if not body.get("agendamento"):
        raise HTTPException(status_code=400, detail="Agendamento (cron) é obrigatório.")
    automacao = {
        "nome": body.get("nome") or tipo,
        "agendamento": body["agendamento"],
        "acao": body["acao"],
        "ativa": body.get("ativa", True),
        "criadoPor": usuario.uid,
        "criadoEm": int(time.time() * 1000),
    }
    ref = db.tenant_push(tenant_id, "studio", "automacoes", automacao)
    audit.registrar(db, uid=usuario.uid, acao="Criar automação Studio", tenant_id=tenant_id, contexto={"tipo": tipo})
    return {"sucesso": True, "automacaoId": ref.key}


@router.get("/studio/{tenant_id}/automacoes")
def studio_listar(tenant_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "_instituicao", "visualizar")
    autos = db.tenant_get(tenant_id, "studio", "automacoes") or {}
    return {"sucesso": True, "automacoes": [{"id": k, **v} for k, v in autos.items()],
            "acoesDisponiveis": sorted(ACOES_STUDIO)}


@router.post("/studio/{tenant_id}/automacoes/{automacao_id}/executar")
def studio_executar(tenant_id: str, automacao_id: str, usuario: UsuarioAtual = Depends(get_usuario_atual)):
    _exigir(usuario, tenant_id, "_instituicao", "gerenciar")
    auto = db.tenant_get(tenant_id, "studio", "automacoes", automacao_id)
    if not auto:
        raise HTTPException(status_code=404, detail="Automação não encontrada.")
    handler = ACOES_STUDIO.get((auto.get("acao") or {}).get("tipo"))
    if not handler:
        raise HTTPException(status_code=400, detail="Ação não implementada.")
    resultado = handler(tenant_id, (auto.get("acao") or {}).get("params") or {})
    db.tenant_push(tenant_id, "studio", "execucoes", {
        "automacaoId": automacao_id, "resultado": resultado, "timestamp": int(time.time() * 1000),
    })
    return {"sucesso": True, "resultado": resultado}
