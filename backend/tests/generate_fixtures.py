"""Gera os golden fixtures executando o código LEGADO (server.py na raiz do repo).

Uso: python backend/tests/generate_fixtures.py
Requer flask instalado (apenas para gerar fixtures; não é dependência do backend novo).
"""
import json
import os
import random
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, REPO_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import golden_payloads as P  # noqa: E402

import server  # noqa: E402  (legado)

# Licença não faz parte do motor: neutraliza para gerar fixtures do algoritmo.
server.validar_licenca = lambda uid, sistema: (True, "fixture")

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), 'fixtures')
os.makedirs(FIXTURES_DIR, exist_ok=True)


def call_route(fn, payload, seed=42):
    random.seed(seed)
    with server.app.test_request_context(json=payload):
        resp = fn()
        return json.loads(resp[0].get_data(as_text=True)) if isinstance(resp, tuple) else json.loads(resp.get_data(as_text=True))


def main():
    fixtures = {
        'mapia.json': call_route(server.gerar_mapia, P.MAPIA),
        'remanejia.json': call_route(server.gerar_remanejia, P.REMANEJIA),
        'avalia.json': call_route(server.gerar_avalia, P.AVALIA),
        'somatoria.json': call_route(server.somatoria_calcular, P.SOMATORIA),
        'tri.json': call_route(server.analise_tri, P.TRI),
        'horia.json': server.executar_logica_horario(P.HORIA, modo='gerar_padrao'),
        'horia_inviavel.json': server.executar_logica_horario(P.HORIA_INVIAVEL, modo='gerar_padrao'),
    }
    for name, data in fixtures.items():
        path = os.path.join(FIXTURES_DIR, name)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"fixture salvo: {name}")


if __name__ == '__main__':
    main()
