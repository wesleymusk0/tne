"""HorIA — geração de grade de horários com Google OR-Tools CP-SAT.

Port 1:1 da lógica legada (server.py: executar_logica_horario +
gerar_sugestoes_detalhadas). Não alterar restrições, objetivos ou timeouts
sem autorização explícita.
"""
from collections import defaultdict

from ortools.sat.python import cp_model


def executar_logica_horario(data, modo='gerar_padrao'):
    # --- Dados Básicos ---
    prof_data = data.get('professores', [])
    turma_data = data.get('turmas', [])
    grade_data = data.get('grade_curricular', {})
    prof_disc_data = data.get('prof_disc', {})
    horario_list = data.get('horarios', [])
    dia_list = data.get('dias_semana', [])
    escola_info = data.get('escola_info', {})
    fixos_manuais = data.get('fixos', {})
    horario_base = data.get('horario_base', {})
    regras_personalizadas = data.get('regras_personalizadas', [])

    num_aulas_dia = len(horario_list)
    num_dias = len(dia_list)
    num_slots_total = num_aulas_dia * num_dias

    if num_aulas_dia == 0 or num_dias == 0:
        return {'sucesso': False, 'mensagem': 'Configuração de dias/aulas inválida.'}

    day_aula_to_slot = {}
    slot_to_day_aula = {}
    for dia in range(num_dias):
        for aula in range(num_aulas_dia):
            s = dia * num_aulas_dia + aula
            day_aula_to_slot[(dia, aula)] = s
            slot_to_day_aula[s] = (dia, aula)

    # Restrições Fixas (Manuais pelo usuário)
    restricoes_fixas = defaultdict(list)
    if fixos_manuais:
        for turma_nome, dias_structure in fixos_manuais.items():
            iter_dias = enumerate(dias_structure) if isinstance(dias_structure, list) else dias_structure.items()
            for d_key, aulas_structure in iter_dias:
                if not aulas_structure:
                    continue
                try:
                    d = int(d_key)
                except Exception:
                    continue
                iter_aulas = enumerate(aulas_structure) if isinstance(aulas_structure, list) else aulas_structure.items()
                for a_key, materia_nome in iter_aulas:
                    if not materia_nome:
                        continue
                    try:
                        a = int(a_key)
                        slot = day_aula_to_slot.get((d, a))
                        if slot is not None:
                            restricoes_fixas[(turma_nome, materia_nome)].append(slot)
                    except Exception:
                        continue

    # Apenas se o objetivo for EXCLUSIVAMENTE 'alocar_ha', congelamos o horário base inteiro.
    if modo in ('alocar_ha',) and horario_base:
        base_turmas = horario_base.get('horarios_turmas', {})
        for turma_nome, grid in base_turmas.items():
            for d, dia_aulas in enumerate(grid):
                for a, conteudo_celula in enumerate(dia_aulas):
                    if not conteudo_celula:
                        continue
                    partes = conteudo_celula.split('\n')
                    materia_nome = partes[0].strip()
                    if materia_nome in ('HA', 'Hora-Atividade'):
                        continue
                    slot = day_aula_to_slot.get((d, a))
                    if slot is not None:
                        restricoes_fixas[(turma_nome, materia_nome)].append(slot)

    professores_nomes = set()
    prof_geminada_prefs = {}
    prof_ha_geminada_prefs = {}
    original_professor_availability_slots = defaultdict(set)
    original_professor_ha_slots = defaultdict(set)
    usa_ha = escola_info.get('usa_ha', False)

    for prof in prof_data:
        prof_nome = prof.get('nome')
        if not prof_nome:
            continue
        professores_nomes.add(prof_nome)
        prof_geminada_prefs[prof_nome] = prof.get('aulas_geminadas', 'indiferente').lower()
        prof_ha_geminada_prefs[prof_nome] = prof.get('ha_geminada', 'indiferente').lower()

        disp_raw = prof.get('disponibilidade', [])
        if isinstance(disp_raw, list):
            for r, row in enumerate(disp_raw):
                if not isinstance(row, list):
                    continue
                for c, status in enumerate(row):
                    if str(status).strip().upper() == 'DISPONÍVEL':
                        if r < num_aulas_dia and c < num_dias:
                            original_professor_availability_slots[prof_nome].add((c, r))
        if usa_ha:
            ha_raw = prof.get('disponibilidade_ha', [])
            if isinstance(ha_raw, list):
                for r, row in enumerate(ha_raw):
                    if not isinstance(row, list):
                        continue
                    for c, status in enumerate(row):
                        if str(status).strip().upper() == 'DISPONÍVEL':
                            if r < num_aulas_dia and c < num_dias:
                                original_professor_ha_slots[prof_nome].add((c, r))

    # Construir lista de aulas
    all_lessons = []
    lesson_counter = 0
    for turma_nome, materias_turma in grade_data.items():
        if not isinstance(materias_turma, dict):
            continue
        for materia_nome, num_aulas in materias_turma.items():
            try:
                num_aulas = int(num_aulas)
            except Exception:
                continue
            if num_aulas <= 0:
                continue
            prof_entry = prof_disc_data.get(turma_nome, {}).get(materia_nome, '')
            prof_nome = prof_entry if isinstance(prof_entry, str) else ''
            if not prof_nome:
                continue
            for i in range(num_aulas):
                lesson_counter += 1
                all_lessons.append({
                    'id': lesson_counter, 'type': 'AULA', 'turma': turma_nome,
                    'materia': materia_nome, 'prof': prof_nome, 'instance': i
                })

    ha_lessons = []
    if usa_ha:
        for prof in prof_data:
            prof_nome = prof.get('nome')
            try:
                qtd_ha = int(prof.get('ha_qtd', 0))
            except Exception:
                try:
                    qtd_ha = int(prof.get('hora_atividade', 0))
                except Exception:
                    qtd_ha = 0
            if qtd_ha > 0:
                ha_slots_set = original_professor_ha_slots.get(prof_nome, set())
                if not ha_slots_set:
                    ha_slots_set = original_professor_availability_slots.get(prof_nome, set())
                allowed_indices = sorted([day_aula_to_slot[(d, a)] for d, a in ha_slots_set if (d, a) in day_aula_to_slot])
                for i in range(qtd_ha):
                    lesson_counter += 1
                    ha_lessons.append({
                        'id': lesson_counter, 'type': 'HA', 'prof': prof_nome,
                        'allowed_slots': allowed_indices, 'turma': 'HA', 'materia': 'Hora-Atividade'
                    })

    full_lessons_list = all_lessons + ha_lessons
    if not full_lessons_list:
        return {'sucesso': False, 'mensagem': 'Nenhuma aula para agendar.'}

    ha_lessons_by_prof = defaultdict(list)
    for l in ha_lessons:
        ha_lessons_by_prof[l['prof']].append(l['id'])

    grouped = defaultdict(list)
    for l in all_lessons:
        grouped[(l['turma'], l['materia'])].append(l['id'])

    regras_bloqueio = [r for r in regras_personalizadas if r.get('tipo') == 'bloqueio_horario']
    regras_incompatibilidade = [{'turma': r.get('turma'), 'mat1': r.get('materia'), 'mat2': r.get('materia_2')}
                                for r in regras_personalizadas if r.get('tipo') == 'incompatibilidade']
    regras_limite = [r for r in regras_personalizadas if r.get('tipo') == 'limite_diario']
    regras_simultaneas = [r for r in regras_personalizadas if r.get('tipo') == 'aulas_simultaneas']

    def resolver_modelo(relaxar_disponibilidade=False, objetivo='default'):
        model = cp_model.CpModel()
        lesson_vars = {}
        violation_vars = []
        prof_teaching_domains = {}
        all_slots_domain_list = list(range(num_slots_total))

        if relaxar_disponibilidade:
            prof_unavail_map = {}
            for prof in professores_nomes:
                arr = [1] * num_slots_total
                slots = original_professor_availability_slots.get(prof, set())
                for (d, a) in slots:
                    if (d, a) in day_aula_to_slot:
                        arr[day_aula_to_slot[(d, a)]] = 0
                prof_unavail_map[prof] = arr
        else:
            for prof in professores_nomes:
                slots = original_professor_availability_slots.get(prof, set())
                indices = sorted([day_aula_to_slot[(d, a)] for d, a in slots if (d, a) in day_aula_to_slot])
                prof_teaching_domains[prof] = indices

        for item in full_lessons_list:
            key = item['id']
            prof = item['prof']
            tipo = item['type']

            if relaxar_disponibilidade:
                var = model.NewIntVar(0, num_slots_total - 1, f"L_{key}")
                if tipo == 'AULA':
                    is_violation = model.NewBoolVar(f"violation_{key}")
                    unavail_array = prof_unavail_map.get(prof, [1] * num_slots_total)
                    model.AddElement(var, unavail_array, is_violation)
                    violation_vars.append(is_violation)
                if tipo == 'HA':
                    slots_ha = item['allowed_slots']
                    if slots_ha:
                        model.AddLinearExpressionInDomain(var, cp_model.Domain.FromValues(slots_ha))
            else:
                if tipo == 'HA':
                    domain_slots = item['allowed_slots']
                else:
                    domain_slots = prof_teaching_domains.get(prof, [])
                if not domain_slots:
                    return None, None, None
                var = model.NewIntVarFromDomain(cp_model.Domain.FromValues(domain_slots), f"L_{key}")

            lesson_vars[key] = var

            if tipo == 'AULA':
                turma = item['turma']
                materia = item['materia']
                pending_fixos = restricoes_fixas.get((turma, materia), [])
                instance_idx = item['instance']
                if instance_idx < len(pending_fixos):
                    sorted_fixos = sorted(pending_fixos)
                    target_slot = sorted_fixos[instance_idx]
                    model.Add(var == target_slot)

        # 1. Aulas Simultâneas (Co-Docência)
        simultaneous_pairs = []
        lessons_to_exclude_from_turma_alldiff = set()
        for regra in regras_simultaneas:
            r_turma = regra.get('turma')
            m1 = regra.get('materia')
            m2 = regra.get('materia_2')
            if not m1 or not m2:
                continue
            turmas_alvo = [r_turma] if r_turma else [t['nome'] for t in turma_data]
            for turma in turmas_alvo:
                ids_m1 = grouped.get((turma, m1), [])
                ids_m2 = grouped.get((turma, m2), [])
                for idx in range(min(len(ids_m1), len(ids_m2))):
                    id1 = ids_m1[idx]
                    id2 = ids_m2[idx]
                    simultaneous_pairs.append((id1, id2))
                    lessons_to_exclude_from_turma_alldiff.add(id2)
        for id1, id2 in simultaneous_pairs:
            model.Add(lesson_vars[id1] == lesson_vars[id2])

        # 2. Turma AllDifferent
        turmas_list = [t['nome'] for t in turma_data]
        for turma in turmas_list:
            t_vars = [lesson_vars[l['id']] for l in all_lessons if l['turma'] == turma and l['id'] not in lessons_to_exclude_from_turma_alldiff]
            if len(t_vars) > 1:
                model.AddAllDifferent(t_vars)

        # 3. Professor AllDifferent
        lessons_to_exclude_from_prof_alldiff = set()
        for id1, id2 in simultaneous_pairs:
            l1 = next((l for l in full_lessons_list if l['id'] == id1), None)
            l2 = next((l for l in full_lessons_list if l['id'] == id2), None)
            if l1 and l2 and l1['prof'] == l2['prof']:
                lessons_to_exclude_from_prof_alldiff.add(id2)
        for prof in professores_nomes:
            p_vars = [lesson_vars[l['id']] for l in full_lessons_list if l['prof'] == prof and l['id'] not in lessons_to_exclude_from_prof_alldiff]
            if len(p_vars) > 1:
                model.AddAllDifferent(p_vars)

        # 4. Limite Diário
        for regra in regras_limite:
            valor_limite = int(regra.get('valor', 2))
            filtro_turma = regra.get('turma')
            filtro_materia = regra.get('materia')
            excecao_materia = regra.get('materia_2')
            turmas_alvo = [filtro_turma] if filtro_turma else turmas_list
            for turma in turmas_alvo:
                ids_para_somar = []
                for l in all_lessons:
                    if l['turma'] != turma:
                        continue
                    if filtro_materia and l['materia'] != filtro_materia:
                        continue
                    if excecao_materia and l['materia'] == excecao_materia:
                        continue
                    if l['id'] in lessons_to_exclude_from_turma_alldiff:
                        continue
                    ids_para_somar.append(l['id'])
                if not ids_para_somar:
                    continue
                for d in range(num_dias):
                    day_slots = [day_aula_to_slot[(d, a)] for a in range(num_aulas_dia)]
                    day_domain = cp_model.Domain.FromValues(day_slots)
                    bools_no_dia = []
                    for lid in ids_para_somar:
                        b = model.NewBoolVar(f"limite_{turma}_{lid}_d{d}")
                        model.AddLinearExpressionInDomain(lesson_vars[lid], day_domain).OnlyEnforceIf(b)
                        not_day = cp_model.Domain.FromValues(list(set(all_slots_domain_list) - set(day_slots)))
                        model.AddLinearExpressionInDomain(lesson_vars[lid], not_day).OnlyEnforceIf(b.Not())
                        bools_no_dia.append(b)
                    model.Add(sum(bools_no_dia) <= valor_limite)

        # 5. Geminação Aulas
        valid_doubles = []
        for d in range(num_dias):
            for a in range(num_aulas_dia - 1):
                s1 = day_aula_to_slot[(d, a)]
                s2 = day_aula_to_slot[(d, a + 1)]
                valid_doubles.append((s1, s2))
                valid_doubles.append((s2, s1))
        for (t, m), ids in grouped.items():
            if len(ids) < 2:
                continue
            prof = next((l['prof'] for l in all_lessons if l['id'] == ids[0]), '')
            pref = prof_geminada_prefs.get(prof, 'indiferente')
            if pref == 'sim':
                sorted_ids = sorted(ids, key=lambda x: next(l['instance'] for l in all_lessons if l['id'] == x))
                for k in range(0, len(sorted_ids) - 1, 2):
                    model.AddAllowedAssignments([lesson_vars[sorted_ids[k]], lesson_vars[sorted_ids[k + 1]]], valid_doubles)
            elif pref == 'não':
                for i in range(len(ids)):
                    for j in range(i + 1, len(ids)):
                        model.AddForbiddenAssignments([lesson_vars[ids[i]], lesson_vars[ids[j]]], valid_doubles)

        # 6. Geminação HA
        for prof, ha_ids in ha_lessons_by_prof.items():
            if len(ha_ids) < 2:
                continue
            pref = prof_ha_geminada_prefs.get(prof, 'indiferente')
            if pref == 'sim':
                sorted_ids = sorted(ha_ids)
                for k in range(0, len(sorted_ids) - 1, 2):
                    model.AddAllowedAssignments([lesson_vars[sorted_ids[k]], lesson_vars[sorted_ids[k + 1]]], valid_doubles)
            elif pref == 'não':
                for i in range(len(ha_ids)):
                    for j in range(i + 1, len(ha_ids)):
                        model.AddForbiddenAssignments([lesson_vars[ha_ids[i]], lesson_vars[ha_ids[j]]], valid_doubles)

        # 7. Bloqueio de Horários
        for regra in regras_bloqueio:
            filtro_turma = regra.get('turma')
            filtro_materia = regra.get('materia')
            filtro_prof = regra.get('professor')
            licoes_afetadas = []
            for l in full_lessons_list:
                if filtro_turma and l.get('turma') != filtro_turma:
                    continue
                if filtro_materia and l.get('materia') != filtro_materia:
                    continue
                if filtro_prof and l.get('prof') != filtro_prof:
                    continue
                licoes_afetadas.append(l['id'])
            if not licoes_afetadas:
                continue
            regra_dia = regra.get('dia_indice')
            regra_aula = regra.get('aula_indice')
            dias_alvo = range(num_dias) if regra_dia is None or regra_dia == "" else [int(regra_dia)]
            aulas_alvo = range(num_aulas_dia) if regra_aula is None or regra_aula == "" else [int(regra_aula)]
            slots_proibidos = []
            for d in dias_alvo:
                for a in aulas_alvo:
                    s = day_aula_to_slot.get((d, a))
                    if s is not None:
                        slots_proibidos.append(s)
            if slots_proibidos:
                for lid in licoes_afetadas:
                    if lid in lesson_vars:
                        for slot_bad in slots_proibidos:
                            model.Add(lesson_vars[lid] != slot_bad)

        # 8. Incompatibilidades
        for regra in regras_incompatibilidade:
            turma_alvo = regra['turma']
            mat1 = regra['mat1']
            mat2 = regra['mat2']
            if not turma_alvo or not mat1 or not mat2:
                continue
            ids_m1 = grouped.get((turma_alvo, mat1), [])
            ids_m2 = grouped.get((turma_alvo, mat2), [])
            if not ids_m1 or not ids_m2:
                continue
            for d in range(num_dias):
                day_slots = [day_aula_to_slot[(d, a)] for a in range(num_aulas_dia)]
                day_domain = cp_model.Domain.FromValues(day_slots)
                has_m1 = model.NewBoolVar(f"inc_{turma_alvo}_{mat1}_d{d}")
                bools_m1 = []
                for lid in ids_m1:
                    b = model.NewBoolVar(f"b_inc_{lid}_d{d}")
                    model.AddLinearExpressionInDomain(lesson_vars[lid], day_domain).OnlyEnforceIf(b)
                    not_day = cp_model.Domain.FromValues(list(set(all_slots_domain_list) - set(day_slots)))
                    model.AddLinearExpressionInDomain(lesson_vars[lid], not_day).OnlyEnforceIf(b.Not())
                    bools_m1.append(b)
                model.Add(sum(bools_m1) > 0).OnlyEnforceIf(has_m1)
                model.Add(sum(bools_m1) == 0).OnlyEnforceIf(has_m1.Not())
                has_m2 = model.NewBoolVar(f"inc_{turma_alvo}_{mat2}_d{d}")
                bools_m2 = []
                for lid in ids_m2:
                    b = model.NewBoolVar(f"b_inc_{lid}_d{d}")
                    model.AddLinearExpressionInDomain(lesson_vars[lid], day_domain).OnlyEnforceIf(b)
                    not_day = cp_model.Domain.FromValues(list(set(all_slots_domain_list) - set(day_slots)))
                    model.AddLinearExpressionInDomain(lesson_vars[lid], not_day).OnlyEnforceIf(b.Not())
                    bools_m2.append(b)
                model.Add(sum(bools_m2) > 0).OnlyEnforceIf(has_m2)
                model.Add(sum(bools_m2) == 0).OnlyEnforceIf(has_m2.Not())
                model.Add(has_m1 + has_m2 <= 1)

        # --- Função Objetivo ---
        gap_vars_total = []
        working_days_total = []
        balance_penalties = []
        lessons_by_prof = defaultdict(list)
        for l in full_lessons_list:
            lessons_by_prof[l['prof']].append(l['id'])

        if objetivo in ('min_janelas', 'balancear_carga', 'reduzir_dias'):
            for prof, l_ids in lessons_by_prof.items():
                if not l_ids:
                    continue
                valid_slots_prof = set(prof_teaching_domains.get(prof, []))
                for d in range(num_dias):
                    day_global_slots = []
                    for a in range(num_aulas_dia):
                        s_global = day_aula_to_slot.get((d, a))
                        if s_global is not None and s_global in valid_slots_prof:
                            day_global_slots.append(s_global)
                    if not day_global_slots:
                        continue
                    occupied_bools = []
                    for s_global in day_global_slots:
                        b_occ = model.NewBoolVar(f"occ_{prof}_{d}_{s_global}")
                        matches = []
                        for lid in l_ids:
                            b_match = model.NewBoolVar(f"m_{lid}_{s_global}")
                            model.Add(lesson_vars[lid] == s_global).OnlyEnforceIf(b_match)
                            model.Add(lesson_vars[lid] != s_global).OnlyEnforceIf(b_match.Not())
                            matches.append(b_match)
                        if matches:
                            model.Add(sum(matches) >= 1).OnlyEnforceIf(b_occ)
                            model.Add(sum(matches) == 0).OnlyEnforceIf(b_occ.Not())
                            occupied_bools.append(b_occ)
                        else:
                            model.Add(b_occ == 0)
                            occupied_bools.append(b_occ)
                    is_working_day = model.NewBoolVar(f"working_{prof}_{d}")
                    model.AddMaxEquality(is_working_day, occupied_bools)
                    working_days_total.append(is_working_day)

                    start_idx = model.NewIntVar(0, num_aulas_dia, f"s_{prof}_{d}")
                    end_idx = model.NewIntVar(0, num_aulas_dia, f"e_{prof}_{d}")
                    for k, b_var in enumerate(occupied_bools):
                        aula_idx = day_global_slots[k] % num_aulas_dia
                        model.Add(start_idx <= aula_idx).OnlyEnforceIf(b_var)
                        model.Add(end_idx >= aula_idx).OnlyEnforceIf(b_var)
                    count_classes = sum(occupied_bools)
                    daily_gap = model.NewIntVar(0, num_aulas_dia, f"gap_{prof}_{d}")
                    model.Add(daily_gap == (end_idx - start_idx + 1) - count_classes).OnlyEnforceIf(is_working_day)
                    model.Add(daily_gap == 0).OnlyEnforceIf(is_working_day.Not())
                    gap_vars_total.append(daily_gap)

                    if objetivo == 'balancear_carga':
                        total_aulas_prof = len(l_ids)
                        media = total_aulas_prof / num_dias
                        desvio = model.NewIntVar(0, num_aulas_dia, f"desvio_{prof}_{d}")
                        model.Add(desvio >= count_classes - int(media))
                        model.Add(desvio >= int(media) - count_classes)
                        balance_penalties.append(desvio * 10)

            if objetivo == 'min_janelas':
                if gap_vars_total or working_days_total:
                    model.Minimize(sum(gap_vars_total) * 100 + sum(working_days_total) * 5)
            elif objetivo == 'balancear_carga':
                if balance_penalties:
                    model.Minimize(sum(balance_penalties))
            elif objetivo == 'reduzir_dias':
                if working_days_total:
                    model.Minimize(sum(working_days_total))

        elif relaxar_disponibilidade and violation_vars:
            model.Minimize(sum(violation_vars))

        solver = cp_model.CpSolver()
        if modo in ('otimizar_janelas', 'balancear_carga', 'reduzir_dias'):
            solver.parameters.max_time_in_seconds = 60.0
            solver.parameters.num_search_workers = 8
        else:
            solver.parameters.max_time_in_seconds = 20.0

        status = solver.Solve(model)
        return status, solver, lesson_vars

    # Determinar objetivo
    objetivo = 'default'
    if modo == 'gerar_padrao' and not usa_ha:
        objetivo = 'min_janelas'
    elif modo == 'otimizar_janelas':
        objetivo = 'min_janelas'
    elif modo == 'balancear_carga':
        objetivo = 'balancear_carga'
    elif modo == 'reduzir_dias':
        objetivo = 'reduzir_dias'

    status, solver, lesson_vars = resolver_modelo(relaxar_disponibilidade=False, objetivo=objetivo)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        horarios_turmas = {t: [['' for _ in range(num_aulas_dia)] for _ in range(num_dias)] for t in [tr['nome'] for tr in turma_data]}
        horarios_professores = {p: [['' for _ in range(num_aulas_dia)] for _ in range(num_dias)] for p in professores_nomes}

        for item in full_lessons_list:
            val = solver.Value(lesson_vars[item['id']])
            d, a = slot_to_day_aula[val]
            prof = item['prof']

            if item['type'] == 'HA':
                if horarios_professores[prof][d][a] == "":
                    horarios_professores[prof][d][a] = "HA"
                else:
                    horarios_professores[prof][d][a] += " / HA"
            else:
                turma = item['turma']
                mat = item['materia']
                txt_turma = f"{mat}\n({prof})"
                if horarios_turmas[turma][d][a] == "":
                    horarios_turmas[turma][d][a] = txt_turma
                else:
                    horarios_turmas[turma][d][a] += f"\n---\n{txt_turma}"
                txt_prof = f"{mat}\n({turma})"
                if horarios_professores[prof][d][a] == "":
                    horarios_professores[prof][d][a] = txt_prof
                else:
                    if turma not in horarios_professores[prof][d][a]:
                        horarios_professores[prof][d][a] += f" / {turma}"

        msg_tipo = {
            'gerar_padrao': '',
            'otimizar_janelas': ' (Janelas Otimizadas)',
            'balancear_carga': ' (Carga Balanceada)',
            'alocar_ha': ' (HAs Alocadas)',
            'reduzir_dias': ' (Dias Reduzidos)'
        }.get(modo, '')

        return {
            'sucesso': True,
            'mensagem': f"Sucesso! {solver.StatusName(status)}{msg_tipo}",
            'horarios_turmas': horarios_turmas,
            'horarios_professores': horarios_professores
        }
    else:
        sugestoes = gerar_sugestoes_detalhadas(
            data, status, None, None, full_lessons_list,
            day_aula_to_slot, slot_to_day_aula, num_aulas_dia, num_dias,
            horario_list, dia_list, original_professor_availability_slots,
            restricoes_fixas, prof_geminada_prefs, regras_incompatibilidade,
            regras_limite
        )
        msg_falha = "Não foi possível gerar o horário com essas restrições."
        if sugestoes:
            msg_falha += "\n\nSugestões:\n" + "\n".join(sugestoes)
        return {'sucesso': False, 'mensagem': msg_falha}


def gerar_sugestoes_detalhadas(data, status_modelo, solver, lesson_vars, full_lessons_list,
                               day_aula_to_slot, slot_to_day_aula, num_aulas_dia, num_dias,
                               horario_list, dia_list, original_professor_availability_slots,
                               restricoes_fixas, prof_geminada_prefs, regras_incompatibilidade,
                               regras_limite):
    sugestoes = []

    # 1. Disponibilidade insuficiente
    profs_com_deficit = []
    for prof, slots_permitidos in original_professor_availability_slots.items():
        total_aulas = sum(1 for l in full_lessons_list if l['prof'] == prof and l['type'] == 'AULA')
        if total_aulas > len(slots_permitidos):
            profs_com_deficit.append((prof, total_aulas, len(slots_permitidos)))
    if profs_com_deficit:
        sugestoes.append("⚠️ **Disponibilidade insuficiente:**")
        for prof, aulas, disp in profs_com_deficit:
            sugestoes.append(f"  - {prof}: precisa de {aulas} horários, mas só tem {disp} disponíveis.")

    # 2. Fixações conflitantes com disponibilidade
    for (turma, materia), slots_fixos in restricoes_fixas.items():
        prof = next((l['prof'] for l in full_lessons_list if l['turma'] == turma and l['materia'] == materia), None)
        if prof and prof in original_professor_availability_slots:
            disponiveis = original_professor_availability_slots[prof]
            for slot in slots_fixos:
                d, a = slot_to_day_aula[slot]
                if (d, a) not in disponiveis:
                    sugestoes.append(f"  - Fixação de {turma} - {materia} no {dia_list[d]} {horario_list[a]} está em horário indisponível para {prof}.")
        if len(slots_fixos) != len(set(slots_fixos)):
            sugestoes.append(f"  - Fixações duplicadas para {turma} - {materia} no mesmo horário.")

    # 3. Geminação impossível
    for prof, pref in prof_geminada_prefs.items():
        if pref == 'sim':
            disponiveis = original_professor_availability_slots.get(prof, set())
            slots_disponiveis = [day_aula_to_slot[(d, a)] for d, a in disponiveis if (d, a) in day_aula_to_slot]
            pares_consecutivos = 0
            for d in range(num_dias):
                for a in range(num_aulas_dia - 1):
                    s1 = day_aula_to_slot.get((d, a))
                    s2 = day_aula_to_slot.get((d, a + 1))
                    if s1 in slots_disponiveis and s2 in slots_disponiveis:
                        pares_consecutivos += 1
            aulas_prof = [l for l in full_lessons_list if l['prof'] == prof and l['type'] == 'AULA']
            grupos = defaultdict(list)
            for l in aulas_prof:
                grupos[(l['turma'], l['materia'])].append(l)
            pares_necessarios = sum(len(ids) // 2 for ids in grupos.values())
            if pares_consecutivos < pares_necessarios:
                sugestoes.append(f"  - Professor {prof} precisa de {pares_necessarios} pares geminados, mas só há {pares_consecutivos} horários consecutivos disponíveis.")

    # 4. Incompatibilidades inviáveis
    for regra in regras_incompatibilidade:
        turma_alvo = regra.get('turma')
        mat1 = regra.get('mat1')
        mat2 = regra.get('mat2')
        if not turma_alvo or not mat1 or not mat2:
            continue
        aulas1 = sum(1 for l in full_lessons_list if l['turma'] == turma_alvo and l['materia'] == mat1)
        aulas2 = sum(1 for l in full_lessons_list if l['turma'] == turma_alvo and l['materia'] == mat2)
        if aulas1 + aulas2 > num_dias:
            sugestoes.append(f"  - Incompatibilidade: {mat1} e {mat2} na turma {turma_alvo} totalizam {aulas1 + aulas2} aulas, mas só há {num_dias} dias para separá-las.")

    # 5. Limite diário excedido
    for regra in regras_limite:
        valor_limite = int(regra.get('valor', 2))
        filtro_turma = regra.get('turma')
        filtro_materia = regra.get('materia')
        excecao = regra.get('materia_2')
        if not filtro_turma:
            continue
        total = 0
        for l in full_lessons_list:
            if l['type'] != 'AULA':
                continue
            if l['turma'] != filtro_turma:
                continue
            if filtro_materia and l['materia'] != filtro_materia:
                continue
            if excecao and l['materia'] == excecao:
                continue
            total += 1
        if total > valor_limite * num_dias:
            sugestoes.append(f"  - Limite diário de {valor_limite} para {filtro_turma} {filtro_materia or ''} excede capacidade total ({total} aulas para {num_dias} dias).")

    # 6. Problemas de HA
    ha_lessons = [l for l in full_lessons_list if l['type'] == 'HA']
    for ha in ha_lessons:
        if not ha['allowed_slots']:
            sugestoes.append(f"  - Professor {ha['prof']} precisa de HA mas não tem nenhum horário disponível para HA.")

    if not sugestoes:
        sugestoes.append("Nenhum problema específico identificado. Verifique se todas as turmas e matérias estão corretamente associadas e se não há conflitos de horário não modelados.")

    return sugestoes
