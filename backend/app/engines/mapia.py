"""MapIA — heurística de mapeamento de sala.

Port 1:1 da lógica legada (server.py /mapia/gerar). Não alterar pesos,
prioridades ou o cálculo de distância sem autorização explícita.
"""
import random


def manhattan_distance(r1, c1, r2, c2):
    return abs(r1 - r2) + abs(c1 - c2)


def is_near(r, c, cells_set, radius=1):
    for cr, cc in cells_set:
        if manhattan_distance(r, c, cr, cc) <= radius:
            return True
    return False


def gerar_mapa(data):
    students = data.get('students', [])
    cols = data.get('columns', 1)
    desks_per_col = {int(k): v for k, v in data.get('carteirasPorColuna', {}).items()}
    max_r = max(desks_per_col.values()) if desks_per_col else 0

    door_cells = {tuple(map(int, k.split(','))) for k in data.get('doorPixelCells', [])}
    prof_cells = {tuple(map(int, k.split(','))) for k in data.get('profPixelCells', [])}
    window_cells = {tuple(map(int, k.split(','))) for k in data.get('windowPixelCells', [])}

    avail = []
    row_letters = [chr(65 + i) for i in range(max_r)]
    for c in range(1, cols + 1):
        for r in range(desks_per_col.get(c, 0)):
            avail.append({"code": f"{row_letters[r]}{c}", "row": r, "col": c - 1})

    def get_priority(s):
        p = 0
        if s.get('pcd'): p += 1000
        if s.get('vision') or s.get('hearing'): p += 900
        if s.get('autism') or s.get('adhd') or s.get('tod') or s.get('intellectualDisability'): p += 800
        if s.get('shortStudent'): p += 700
        if s.get('tall'): p += 600
        if s.get('talksWith'): p += 500
        return p

    sorted_students = sorted(students, key=get_priority, reverse=True)
    arr = []
    occ = {}

    for s in sorted_students:
        best_seat = None
        max_score = -float('inf')
        random.shuffle(avail)

        for seat in avail:
            r, c = seat['row'], seat['col']
            score = 0

            if s.get('vision') or s.get('hearing') or s.get('shortStudent'):
                if r == 0: score += 2000
                elif r == 1: score += 1000
                else: score -= (r * 500)

            if s.get('tall'):
                if any([s.get('vision'), s.get('hearing'), s.get('autism'), s.get('adhd'), s.get('tod')]):
                    if c == 0 or c == cols - 1: score += 300
                    else: score -= 100
                else:
                    score += r * 400
                    if c == 0 or c == cols - 1: score += 200

            if s.get('pcd'):
                if is_near(r, c, door_cells): score += 3000
                elif c == 0 or c == cols - 1: score += 500
                else: score -= 800

            if s.get('autism') or s.get('adhd') or s.get('tod') or s.get('intellectualDisability'):
                if r == 0: score += 2000
                elif r == 1: score += 1000
                else: score -= (r * 600)
                if is_near(r, c, prof_cells): score += 400
                if is_near(r, c, window_cells): score -= 800

            if s.get('talksWith'):
                for friend in s['talksWith']:
                    friend_seat = occ.get(friend)
                    if friend_seat:
                        dist = manhattan_distance(r, c, friend_seat['row'], friend_seat['col'])
                        if dist == 1: score -= 5000
                        elif dist == 2: score -= 800

            if score == 0 and not s.get('tall') and not s.get('pcd'):
                score += (max_r - 1 - r) * 2

            if score > max_score:
                max_score = score
                best_seat = seat

        if best_seat:
            arr.append({"name": s['name'], "seat": best_seat['code']})
            occ[s['name']] = best_seat
            avail = [x for x in avail if x['code'] != best_seat['code']]

    return {'sucesso': True, 'arrangement': arr}
