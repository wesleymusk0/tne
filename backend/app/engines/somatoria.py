"""SomatorIA — cálculo de notas por somatória binária.

Port 1:1 da lógica legada (server.py /somatoria/calcular): acerto parcial
proporcional aos bits corretos; qualquer alternativa errada assinalada zera
a questão. Não alterar a matemática sem autorização explícita.
"""


def calcular_notas(data):
    respostas = data.get('respostas', [])
    gabaritos = data.get('gabaritos', [])
    valores = data.get('valores', [])

    notas = []
    total = 0.0

    for r, g, v in zip(respostas, gabaritos, valores):
        try:
            R = int(r)
            G = int(g)
            C = float(v)

            if R == G:
                nota = C  # Acerto Total
            elif (R & G) == R and R > 0:
                # Acerto Parcial (nenhuma alternativa errada assinalada)
                bits_R = bin(R).count("1")
                bits_G = bin(G).count("1")
                nota = (bits_R / bits_G) * C
            else:
                nota = 0.0  # Assinalou algo errado = zera a questão
        except Exception:
            nota = 0.0

        nota = round(nota, 1)
        notas.append(nota)
        total += nota

    return {
        'sucesso': True,
        'notas': notas,
        'total': round(total, 1)
    }
