"""Testes dos módulos core: planos, regras institucionais e permissões."""
from datetime import datetime, timezone

import pytest

from app.core import permissions, plans, rules


# --- Planos ------------------------------------------------------------------
def test_free_libera_sistemas_corretos():
    for sistema in ["mapia", "provia", "avalia", "somatoria", "tri", "buscia"]:
        ok, _ = plans.verificar_acesso_sistema("free", "ativa", sistema)
        assert ok, sistema


def test_free_bloqueia_horia_e_remanejia():
    for sistema in ["horia", "remanejia", "domicilia", "notas", "presenca"]:
        ok, msg = plans.verificar_acesso_sistema("free", "ativa", sistema)
        assert not ok
        assert "plano" in msg.lower()


def test_profissional_libera_horia_e_remanejia():
    for sistema in ["horia", "remanejia"]:
        ok, _ = plans.verificar_acesso_sistema("profissional", "ativa", sistema)
        assert ok, sistema


def test_assinatura_suspensa_bloqueia_tudo():
    ok, msg = plans.verificar_acesso_sistema("profissional", "suspensa", "mapia")
    assert not ok
    assert "suspensa" in msg.lower()


def test_limite_free_mapia_20_alunos():
    ok, _ = plans.verificar_limite("free", "mapia", "max_alunos_por_mapa", 19)
    assert ok
    ok, msg = plans.verificar_limite("free", "mapia", "max_alunos_por_mapa", 20)
    assert not ok


def test_limite_free_provia_4_questoes():
    ok, _ = plans.verificar_limite("free", "provia", "max_questoes_por_prova", 3)
    assert ok
    ok, _ = plans.verificar_limite("free", "provia", "max_questoes_por_prova", 4)
    assert not ok


def test_limites_free_contadores():
    casos = [
        ("avalia", "max_triagens", 3),
        ("tri", "max_simulacoes", 3),
        ("somatoria", "max_correcoes", 5),
        ("buscia", "max_mensagens_semana", 15),
    ]
    for sistema, chave, limite in casos:
        ok, _ = plans.verificar_limite("free", sistema, chave, limite - 1)
        assert ok, sistema
        ok, _ = plans.verificar_limite("free", sistema, chave, limite)
        assert not ok, sistema


def test_essencial_sem_limites_do_free():
    for sistema, chave in [("mapia", "max_alunos_por_mapa"), ("provia", "max_questoes_por_prova")]:
        ok, _ = plans.verificar_limite("essencial", sistema, chave, 10**9)
        assert ok, sistema


def test_escola_somente_contratados():
    contrato = {"status": "ativo", "sistemas": ["MapIA", "NoTaS", "Presenca"]}
    assert plans.sistemas_escola(contrato) == ["mapia", "notas", "presenca"]
    assert plans.sistemas_escola({"status": "suspenso", "sistemas": ["mapia"]}) == []


# --- Regras institucionais ---------------------------------------------------
def test_regra_literal_limite_no_periodo():
    regra = {"sistema": "mapia", "periodo": "trimestre", "limite": 3}
    ok, _ = rules.verificar_regra(regra, 2)
    assert ok
    ok, msg = rules.verificar_regra(regra, 3)
    assert not ok
    assert "trimestre" in msg


def test_regra_zero_sempre_bloqueia():
    ok, msg = rules.verificar_regra({"sistema": "mapia", "periodo": "mes", "limite": 0}, 0)
    assert not ok
    assert "Projeto de Mapa" in msg


def test_janelas_periodo_literais():
    dt = datetime(2026, 8, 19, tzinfo=timezone.utc)  # quarta-feira (quarta semana, 3º trimestre)
    ini, fim = rules.janela_periodo("trimestre", dt)
    assert datetime.fromtimestamp(ini / 1000, tz=timezone.utc).month == 7  # jul–set
    assert datetime.fromtimestamp(fim / 1000, tz=timezone.utc).month == 10
    ini, fim = rules.janela_periodo("mes", dt)
    assert datetime.fromtimestamp(ini / 1000, tz=timezone.utc).month == 8
    assert datetime.fromtimestamp(fim / 1000, tz=timezone.utc).month == 9
    ini, fim = rules.janela_periodo("semestre", dt)
    assert datetime.fromtimestamp(ini / 1000, tz=timezone.utc).month == 7
    assert datetime.fromtimestamp(fim / 1000, tz=timezone.utc).year == 2027
    ini, fim = rules.janela_periodo("ano", dt)
    assert datetime.fromtimestamp(ini / 1000, tz=timezone.utc).year == 2026
    assert datetime.fromtimestamp(fim / 1000, tz=timezone.utc).year == 2027
    assert rules.janela_periodo("total", dt) == (0, None)


def test_janela_semana_comeca_segunda():
    dt = datetime(2026, 8, 19, tzinfo=timezone.utc)  # quarta-feira
    ini, fim = rules.janela_periodo("semana", dt)
    assert datetime.fromtimestamp(ini / 1000, tz=timezone.utc).weekday() == 0
    assert (fim - ini) == 7 * 86400 * 1000


def test_validar_regra():
    assert rules.validar_regra({"sistema": "mapia", "periodo": "mes", "limite": 3}) == []
    assert rules.validar_regra({"sistema": "", "periodo": "mes", "limite": 3})
    assert rules.validar_regra({"sistema": "mapia", "periodo": "quinzena", "limite": 3})
    assert rules.validar_regra({"sistema": "mapia", "periodo": "mes", "limite": -1})


def test_conflito_regra_permissao_detectado():
    regra = {"sistema": "mapia", "periodo": "trimestre", "limite": 0}
    cargos = {
        "professor": {"nome": "Professor", "permissoes": {"mapia": {"criar": True}}},
        "responsavel": {"nome": "Responsável", "permissoes": {"mapia": {"criar": False}}},
    }
    r = rules.detectar_conflito_regra_permissao(regra, cargos)
    assert r["conflito"] is True
    assert [c["cargoId"] for c in r["cargos_afetados"]] == ["professor"]


def test_conflito_nao_existe_com_limite_positivo():
    r = rules.detectar_conflito_regra_permissao(
        {"sistema": "mapia", "periodo": "mes", "limite": 3},
        {"professor": {"permissoes": {"mapia": {"criar": True}}}},
    )
    assert r["conflito"] is False


# --- Permissões ---------------------------------------------------------------
def test_cargos_padrao_existem_sem_aluno():
    assert set(permissions.CARGOS_PADRAO) == {"administrador", "gestor", "professor", "responsavel"}
    assert "aluno" not in permissions.CARGOS_PADRAO


def test_professor_nao_gerencia_horia():
    cargo = permissions.CARGOS_PADRAO["professor"]
    assert permissions.tem_permissao(cargo, "horia", "visualizar") is True
    assert permissions.tem_permissao(cargo, "horia", "criar") is False
    assert permissions.tem_permissao(cargo, "horia", "gerenciar") is False


def test_administrador_pode_tudo():
    cargo = permissions.CARGOS_PADRAO["administrador"]
    for sistema in permissions.SISTEMAS_INSTITUCIONAIS:
        for acao in permissions.ACOES:
            assert permissions.tem_permissao(cargo, sistema, acao)


def test_sistemas_visiveis_intersecao_com_contrato():
    cargo = permissions.CARGOS_PADRAO["professor"]
    visiveis = permissions.sistemas_visiveis(cargo, ["mapia", "notas"])
    assert visiveis == ["mapia", "notas"]


def test_validar_cargo():
    assert permissions.validar_cargo({"nome": "Pedagogo", "permissoes": {"notas": {"visualizar": True}}}) == []
    assert permissions.validar_cargo({"nome": "", "permissoes": {}})
    assert permissions.validar_cargo({"nome": "X", "permissoes": {"notas": {"voar": True}}})
