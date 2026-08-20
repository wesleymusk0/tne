"""Golden tests: o port FastAPI deve reproduzir EXATAMENTE a saída do código
legado (server.py) para os mesmos payloads e mesma seed aleatória.

Fixtures geradas por generate_fixtures.py a partir do código em produção.
Regressão aqui = perda de funcionalidade: NUNCA ajuste o fixture para
esconder uma divergência sem autorização explícita.
"""
import json
import os
import random

import golden_payloads as P

from app.engines import avalia, horia, mapia, remanejia, somatoria, tri

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), 'fixtures')
SEED = 42


def load_fixture(name):
    with open(os.path.join(FIXTURES_DIR, name), encoding='utf-8') as f:
        return json.load(f)


def test_mapia_golden():
    random.seed(SEED)
    result = mapia.gerar_mapa(P.MAPIA)
    assert result == load_fixture('mapia.json')


def test_remanejia_golden():
    random.seed(SEED)
    result = remanejia.gerar_enturmacao(P.REMANEJIA)
    assert result == load_fixture('remanejia.json')


def test_avalia_golden():
    result = avalia.gerar_triagem(P.AVALIA)
    assert result == load_fixture('avalia.json')


def test_somatoria_golden():
    result = somatoria.calcular_notas(P.SOMATORIA)
    assert result == load_fixture('somatoria.json')


def test_tri_golden():
    result = tri.analise_tri(P.TRI)
    assert result == load_fixture('tri.json')


def _invariantes_horario(resultado, payload):
    """Invariantes semânticas de um horário válido (vale para legado e novo).

    O CP-SAT é não-determinístico entre soluções ótimas equivalentes, então a
    paridade com o legado é verificada por INVARIANTES, não por igualdade literal.
    """
    assert resultado["sucesso"] is True
    turmas = resultado["horarios_turmas"]
    profs = resultado["horarios_professores"]

    # 1. Toda aula da grade aparece exatamente o nº de vezes exigido, por turma.
    for turma, materias in payload["grade_curricular"].items():
        for materia, qtd in materias.items():
            prof = payload["prof_disc"][turma][materia]
            esperado = f"{materia}\n({prof})"
            total = sum(celula == esperado or esperado in celula.split("\n---\n")
                        for dia in turmas[turma] for celula in dia)
            assert total == qtd, f"{turma}/{materia}: {total} != {qtd}"

    # 2. Fixações manuais respeitadas.
    for turma, dias in payload.get("fixos", {}).items():
        for d, aulas in dias.items():
            for a, materia in aulas.items():
                prof = payload["prof_disc"][turma][materia]
                celula = turmas[turma][int(d)][int(a)]
                assert celula.split("\n")[0] == materia and prof in celula

    # 3. Professor nunca está em duas turmas no mesmo slot.
    num_dias = len(payload["dias_semana"])
    num_aulas = len(payload["horarios"])
    for d in range(num_dias):
        for a in range(num_aulas):
            for prof_nome, grade_prof in profs.items():
                if grade_prof[d][a]:
                    conteudo = grade_prof[d][a]
                    # consistência: toda turma citada na grade do professor o tem no slot
                    for turma in payload["grade_curricular"]:
                        if f"({turma})" in conteudo:
                            assert prof_nome in turmas[turma][d][a]

    # 4. HAs alocadas conforme solicitado (apenas em slots disponíveis).
    usa_ha = payload["escola_info"].get("usa_ha")
    for prof in payload["professores"]:
        if not usa_ha:
            break
        qtd = int(prof.get("ha_qtd", 0))
        total_ha = sum(1 for dia in profs[prof["nome"]] for celula in dia if "HA" in celula)
        assert total_ha == qtd, f"HA {prof['nome']}: {total_ha} != {qtd}"

    # 5. Aulas só em slots DISPONÍVEL do professor.
    for prof in payload["professores"]:
        grade = profs[prof["nome"]]
        for d in range(num_dias):
            for a in range(num_aulas):
                if grade[d][a] and "HA" not in grade[d][a]:
                    assert str(prof["disponibilidade"][a][d]).upper() == "DISPONÍVEL"


def test_horia_golden_invariantes():
    resultado = horia.executar_logica_horario(P.HORIA, modo='gerar_padrao')
    _invariantes_horario(resultado, P.HORIA)
    # O fixture (saída do legado) deve satisfazer os MESMOS invariantes.
    _invariantes_horario(load_fixture('horia.json'), P.HORIA)


def test_horia_mensagem_formato_legado():
    resultado = horia.executar_logica_horario(P.HORIA, modo='gerar_padrao')
    fixture = load_fixture('horia.json')
    assert resultado["mensagem"].split("!")[0] == fixture["mensagem"].split("!")[0]


def test_horia_inviavel_golden():
    result = horia.executar_logica_horario(P.HORIA_INVIAVEL, modo='gerar_padrao')
    assert result == load_fixture('horia_inviavel.json')
    assert result['sucesso'] is False
