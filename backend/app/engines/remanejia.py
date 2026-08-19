"""RemanejIA — otimização de enturmação.

Port 1:1 da lógica legada (server.py /remanejia/gerar), estendida com o
parâmetro opcional `mixPercentage` (TNE): percentual de alunos elegíveis a
mudar de turma. 100 (padrão) reproduz exatamente o comportamento legado.
"""
import math
import random


def gerar_enturmacao(data):
    students = data.get('students', [])
    num_classes = int(data.get('numClasses', 3))
    priorities = data.get('priorities', {})

    if not students:
        return {'sucesso': False, 'mensagem': 'Sem alunos.'}

    wMand = 3 if priorities.get('pMand') else 1
    wPref = 3 if priorities.get('pPref') else 1
    wBal = 3 if priorities.get('pBal') else 1

    ideal_size = len(students) / num_classes
    total_f = sum(1 for s in students if s.get('gender') == 'F')
    ideal_f = total_f / num_classes

    best_config = None
    best_score = -float('inf')
    best_metrics = None

    for _ in range(50):
        current_classes = [[] for _ in range(num_classes)]
        queue = list(students)
        random.shuffle(queue)
        queue.sort(key=lambda x: len(x.get('constraints', [])), reverse=True)

        placed_ids = set()

        for s in queue:
            if s['id'] in placed_ids:
                continue

            cluster = [s]
            for c in s.get('constraints', []):
                if c['type'] == 'must' and c['targetId'] not in placed_ids:
                    friend = next((x for x in students if x['id'] == c['targetId']), None)
                    if friend:
                        cluster.append(friend)

            best_class_idx = -1
            max_score = -float('inf')

            indices = list(range(num_classes))
            random.shuffle(indices)

            for idx in indices:
                cls = current_classes[idx]

                conflict = False
                for member in cluster:
                    enemies = [c['targetId'] for c in member.get('constraints', []) if c['type'] == 'cannot']
                    if any(x['id'] in enemies for x in cls):
                        conflict = True
                        break
                if conflict:
                    continue

                score = -abs((len(cls) + len(cluster)) - ideal_size) * (30 if priorities.get('pBal') else 10)

                current_f = sum(1 for x in cls if x.get('gender') == 'F')
                cluster_f = sum(1 for x in cluster if x.get('gender') == 'F')
                score -= abs((current_f + cluster_f) - ideal_f) * (30 if priorities.get('pBal') else 15)

                for member in cluster:
                    prefers = [c['targetId'] for c in member.get('constraints', []) if c['type'] == 'prefer']
                    if any(x['id'] in prefers for x in cls):
                        score += (20 if priorities.get('pPref') else 5)

                score += (random.random() - 0.5) * 8

                if score > max_score:
                    max_score = score
                    best_class_idx = idx

            if best_class_idx == -1:
                best_class_idx = min(range(num_classes), key=lambda i: len(current_classes[i]))

            current_classes[best_class_idx].extend(cluster)
            placed_ids.update(x['id'] for x in cluster)

        student_class_map = {s['id']: i for i, cls in enumerate(current_classes) for s in cls}
        man_total = man_met = pref_total = pref_met = can_tot = can_viol = 0

        for s in students:
            my_c = student_class_map.get(s['id'])
            for c in s.get('constraints', []):
                tgt_c = student_class_map.get(c['targetId'])
                if c['type'] == 'must':
                    man_total += 1
                    if tgt_c == my_c: man_met += 1
                elif c['type'] == 'cannot':
                    can_tot += 1
                    if tgt_c == my_c: can_viol += 1
                elif c['type'] == 'prefer':
                    pref_total += 1
                    if tgt_c == my_c: pref_met += 1

        sizes = [len(c) for c in current_classes]
        avg_s = sum(sizes) / len(sizes) if sizes else 0
        std_dev = math.sqrt(sum((x - avg_s) ** 2 for x in sizes) / len(sizes)) if sizes else 0

        s_man = 100 if (man_total + can_tot) == 0 else (((man_met + (can_tot - can_viol)) / (man_total + can_tot)) * 100)
        s_pref = 100 if pref_total == 0 else ((pref_met / pref_total) * 100)
        s_bal = max(0, 100 - (std_dev * 20))

        final_score = ((s_man * wMand) + (s_pref * wPref) + (s_bal * wBal)) / (wMand + wPref + wBal)

        if final_score > best_score:
            best_score = final_score
            best_config = current_classes
            best_metrics = {
                "totalScore": final_score, "mandatoryPct": s_man, "preferPct": s_pref, "balancePct": s_bal,
                "stats": {"mandatoryMet": man_met, "mandatoryTotal": man_total, "preferMet": pref_met,
                          "preferTotal": pref_total, "cannotViolated": can_viol, "cannotTotal": can_tot}
            }

    return {'sucesso': True, 'classes': best_config, 'metrics': best_metrics}


def aplicar_percentual_mistura(students, mix_percentage):
    """Seleciona os alunos elegíveis a mudança conforme o percentual de mistura.

    Retorna (livres, fixos). Alunos ligados por restrições 'must' a um aluno
    livre são liberados junto (o cluster se move atomicamente). Determinístico
    quando random.seed() é fixado pelo chamador.
    """
    if mix_percentage is None or mix_percentage >= 100:
        return list(students), []
    mix_percentage = max(0, min(100, int(mix_percentage)))

    ids = [s['id'] for s in students]
    random.shuffle(ids)
    n_livres = round(len(ids) * mix_percentage / 100)
    livres_ids = set(ids[:n_livres])

    # Propaga: quem tem 'must' com alguém livre também fica livre.
    changed = True
    while changed:
        changed = False
        for s in students:
            if s['id'] in livres_ids:
                continue
            for c in s.get('constraints', []):
                if c.get('type') == 'must' and c.get('targetId') in livres_ids:
                    livres_ids.add(s['id'])
                    changed = True
                    break

    livres = [s for s in students if s['id'] in livres_ids]
    fixos = [s for s in students if s['id'] not in livres_ids]
    return livres, fixos
