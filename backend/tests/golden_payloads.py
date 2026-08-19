"""Payloads representativos usados nos golden tests dos engines.

Os mesmos payloads alimentam o código legado (geração de fixtures) e o
código novo (validação), sempre com random.seed(42) antes de cada chamada.
"""

MAPIA = {
    "students": [
        {"name": "Ana", "pcd": True},
        {"name": "Bruno", "vision": True},
        {"name": "Carla", "hearing": True},
        {"name": "Diego", "autism": True, "tall": True},
        {"name": "Elisa", "adhd": True},
        {"name": "Fabio", "tall": True},
        {"name": "Gabi", "shortStudent": True},
        {"name": "Hugo", "talksWith": ["Iris", "Joao"]},
        {"name": "Iris", "talksWith": ["Hugo"]},
        {"name": "Joao", "tod": True, "talksWith": ["Hugo"]},
        {"name": "Lia", "intellectualDisability": True},
        {"name": "Mauro"},
    ],
    "columns": 3,
    "carteirasPorColuna": {"1": 4, "2": 4, "3": 4},
    "doorPixelCells": ["0,0", "0,1"],
    "profPixelCells": ["0,2"],
    "windowPixelCells": ["3,0", "3,1", "3,2", "3,3"],
}

REMANEJIA = {
    "students": [
        {"id": "s1", "matricula": "100", "name": "Aluno 1", "originalClass": "6A", "gender": "M", "score": 4,
         "constraints": [{"type": "must", "targetId": "s2"}]},
        {"id": "s2", "matricula": "101", "name": "Aluno 2", "originalClass": "6A", "gender": "F", "score": 3,
         "constraints": [{"type": "must", "targetId": "s1"}]},
        {"id": "s3", "matricula": "102", "name": "Aluno 3", "originalClass": "6B", "gender": "M", "score": 5,
         "constraints": [{"type": "cannot", "targetId": "s4"}]},
        {"id": "s4", "matricula": "103", "name": "Aluno 4", "originalClass": "6B", "gender": "F", "score": 2,
         "constraints": [{"type": "cannot", "targetId": "s3"}]},
        {"id": "s5", "matricula": "104", "name": "Aluno 5", "originalClass": "6A", "gender": "F", "score": 4,
         "constraints": [{"type": "prefer", "targetId": "s6"}]},
        {"id": "s6", "matricula": "105", "name": "Aluno 6", "originalClass": "6C", "gender": "M", "score": 3,
         "constraints": []},
        {"id": "s7", "matricula": "106", "name": "Aluno 7", "originalClass": "6C", "gender": "F", "score": 1,
         "constraints": []},
        {"id": "s8", "matricula": "107", "name": "Aluno 8", "originalClass": "6A", "gender": "M", "score": 2,
         "constraints": [{"type": "prefer", "targetId": "s1"}]},
        {"id": "s9", "matricula": "108", "name": "Aluno 9", "originalClass": "6B", "gender": "F", "score": 5,
         "constraints": []},
        {"id": "s10", "matricula": "109", "name": "Aluno 10", "originalClass": "6C", "gender": "M", "score": 3,
         "constraints": []},
        {"id": "s11", "matricula": "110", "name": "Aluno 11", "originalClass": "6A", "gender": "F", "score": 4,
         "constraints": []},
        {"id": "s12", "matricula": "111", "name": "Aluno 12", "originalClass": "6B", "gender": "M", "score": 2,
         "constraints": []},
    ],
    "numClasses": 3,
    "priorities": {"pMand": True, "pPref": True, "pBal": True},
}

AVALIA = {
    "pontuacoes": {"tea": 12, "tdah": 8, "di": 25, "ah": 3, "dislexia": 9, "discalculia": 0, "tod": 18},
    "maximas": {"tea": 30, "tdah": 30, "di": 30, "ah": 30, "dislexia": 20, "discalculia": 20, "tod": 20},
}

SOMATORIA = {
    "respostas": [5, 3, 9, 0, 6, "x"],
    "gabaritos": [5, 7, 8, 4, 7, 3],
    "valores": [2.0, 2.0, 3.0, 1.0, 2.0, 1.0],
}

TRI = {
    "items": [
        {"index": 0, "a": 1.2, "b": -0.5, "c": 0.2},
        {"index": 1, "a": 0.9, "b": 0.3, "c": 0.25},
        {"index": 2, "a": "", "b": "", "c": 0.2},
        {"index": 3, "a": 1.5, "b": 1.1, "c": 0.15},
        {"index": 4, "a": "", "b": "", "c": 0.2},
    ],
    "students": [
        {"studentId": "a1", "responses": [1, 1, 1, 0, 1]},
        {"studentId": "a2", "responses": [0, 1, 0, 0, 1]},
        {"studentId": "a3", "responses": [1, 1, 1, 1, 1]},
        {"studentId": "a4", "responses": [0, 0, 0, 0, 0]},
        {"studentId": "a5", "responses": [1, 0, 1, 0, None]},
        {"studentId": "a6", "responses": [1, 1, 0, 0, 0]},
        {"studentId": "a7", "responses": [0, 1, 1, 0, 1]},
        {"studentId": "a8", "responses": [1, 0, 0, 1, 0]},
    ],
}

HORIA = {
    "escola_info": {"nome": "Escola Teste", "turno": "manha", "aulas": 4, "dias": 5, "usa_ha": True},
    "horarios": ["07:00", "07:50", "08:40", "09:50"],
    "dias_semana": ["SEG", "TER", "QUA", "QUI", "SEX"],
    "turmas": [{"nome": "6A", "aulas": 6}, {"nome": "7A", "aulas": 6}],
    "materias": [{"nome": "MAT"}, {"nome": "PORT"}],
    "professores": [
        {"nome": "Prof Maria", "aulas_geminadas": "sim", "ha_qtd": 2, "ha_geminada": "indiferente",
         "disponibilidade": [["DISPONÍVEL"] * 5 for _ in range(4)],
         "disponibilidade_ha": [["DISPONÍVEL"] * 5 for _ in range(4)]},
        {"nome": "Prof Joao", "aulas_geminadas": "não", "ha_qtd": 1, "ha_geminada": "indiferente",
         "disponibilidade": [["DISPONÍVEL"] * 5 for _ in range(4)],
         "disponibilidade_ha": [["DISPONÍVEL"] * 5 for _ in range(4)]},
    ],
    "grade_curricular": {"6A": {"MAT": 3, "PORT": 3}, "7A": {"MAT": 3, "PORT": 3}},
    "prof_disc": {"6A": {"MAT": "Prof Maria", "PORT": "Prof Joao"},
                  "7A": {"MAT": "Prof Maria", "PORT": "Prof Joao"}},
    "fixos": {"6A": {"0": {"0": "MAT"}}},
    "regras_personalizadas": [
        {"tipo": "limite_diario", "turma": "6A", "materia": "MAT", "valor": 2},
        {"tipo": "incompatibilidade", "turma": "7A", "materia": "MAT", "materia_2": "PORT"},
    ],
}

HORIA_INVIAVEL = {
    "escola_info": {"nome": "Escola Teste", "turno": "manha", "aulas": 2, "dias": 2, "usa_ha": False},
    "horarios": ["07:00", "07:50"],
    "dias_semana": ["SEG", "TER"],
    "turmas": [{"nome": "6A", "aulas": 4}],
    "materias": [{"nome": "MAT"}],
    "professores": [
        {"nome": "Prof Maria", "aulas_geminadas": "indiferente",
         "disponibilidade": [["INDISPONÍVEL", "INDISPONÍVEL"], ["INDISPONÍVEL", "INDISPONÍVEL"]]},
    ],
    "grade_curricular": {"6A": {"MAT": 4}},
    "prof_disc": {"6A": {"MAT": "Prof Maria"}},
    "fixos": {},
    "regras_personalizadas": [],
}
