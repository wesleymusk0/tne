"""Simulador TRI — Teoria de Resposta ao Item (modelo logístico de 3 parâmetros).

Port 1:1 da lógica legada (server.py /tri/analise): calibração heurística de
itens, estimação de theta por máxima verossimilhança e escala SAEB.
"""
import math

SAEB_MEAN, SAEB_SD = 250.0, 50.0


def probability_3pl(theta, a, b, c):
    try:
        exp_val = max(-35.0, min(35.0, -1.702 * float(a) * (float(theta) - float(b))))
        return float(c) + (1.0 - float(c)) / (1.0 + math.exp(exp_val))
    except Exception:
        return float('nan')


def log_likelihood(theta, responses, items):
    ll = 0.0
    for r, item in zip(responses, items):
        if r not in (0, 1):
            continue
        p = probability_3pl(theta, item['a'], item['b'], item['c'])
        if math.isnan(p) or p <= 0.0 or p >= 1.0:
            return float('-inf')
        ll += math.log(p) if r == 1 else math.log(1.0 - p)
    return ll if math.isfinite(ll) else float('-inf')


def estimate_theta(responses, items):
    valid_responses = [r for r in responses if r in (0, 1)]
    if not valid_responses:
        return float('nan')
    soma_acertos = sum(valid_responses)
    if soma_acertos == 0:
        return -4.0
    if soma_acertos == len(valid_responses):
        return 4.0

    best_theta, max_ll = float('nan'), float('-inf')
    theta = -4.0
    while theta <= 4.0:
        ll = log_likelihood(theta, responses, items)
        if ll > max_ll:
            max_ll, best_theta = ll, theta
        theta += 0.01
    return best_theta


def analise_tri(data):
    items = data.get('items', [])
    students = data.get('students', [])

    # Calibração heurística de itens sem parâmetros a/b
    item_stats = [{'acertos': 0, 'count': 0} for _ in items]
    for s in students:
        for i, r in enumerate(s['responses']):
            if r in (0, 1):
                item_stats[i]['count'] += 1
                if r == 1:
                    item_stats[i]['acertos'] += 1

    calibrated_items = []
    for i, item in enumerate(items):
        calib = item.copy()
        if calib.get('a') == "" or calib.get('b') == "":
            count = item_stats[i]['count']
            if count > 0:
                p_value = item_stats[i]['acertos'] / count
                c = float(calib.get('c', 0.2))
                adj_p = max(0.001, min(0.999, (p_value - c) / (1.0 - c)))
                b = 3.0 if p_value <= c else -math.log(adj_p / (1.0 - adj_p))
                calib['a'] = 1.00
                calib['b'] = round(b, 2)
        calibrated_items.append(calib)

    valid_items = [i for i in calibrated_items if i.get('a') is not None]

    scores_dict = {}
    total_saeb = 0
    valid_saeb_count = 0

    for student in students:
        resp = student.get('responses', [])
        valid_resp = [resp[i.get('index')] if i.get('index') < len(resp) else None for i in valid_items]

        theta = estimate_theta(valid_resp, valid_items)

        if math.isnan(theta):
            saeb = None
            theta_out = None
        else:
            saeb = max(0.0, min(500.0, theta * SAEB_SD + SAEB_MEAN))
            theta_out = round(theta, 4)
            total_saeb += saeb
            valid_saeb_count += 1

        scores_dict[student['studentId']] = {
            "theta": theta_out,
            "saebScore": round(saeb, 2) if saeb else None
        }

    return {
        'sucesso': True,
        'items_calibrados': calibrated_items,
        'scores': scores_dict,
        'avgSaeb': round(total_saeb / valid_saeb_count, 2) if valid_saeb_count > 0 else None
    }
