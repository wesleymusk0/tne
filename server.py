from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model
from collections import defaultdict
import math
import time
import traceback
import random
import firebase_admin
from firebase_admin import credentials, db

# ==============================================================================
# CONFIGURAÇÃO INICIAL
# ==============================================================================

# Ajuste o caminho conforme seu ambiente
FIREBASE_CRED_PATH = "/home/systematrix/backend/firebase-service-account.json"
FIREBASE_DB_URL = "https://systematrix-apps-default-rtdb.firebaseio.com/"

app = Flask(__name__)
CORS(app)

# Inicialização do Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(FIREBASE_CRED_PATH)
        firebase_admin.initialize_app(cred, {
            "databaseURL": FIREBASE_DB_URL
        })
    except Exception as e:
        print(f"Erro ao inicializar Firebase: {e}")

MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000

# ==============================================================================
# SISTEMA DE LICENÇAS (UNIFICADO)
# ==============================================================================
def validar_licenca(uid, sistema):
    if not uid or uid == "offline": return False, "UID vazio."
    if not firebase_admin._apps: return False, "Firebase offline."

    try:
        user_ref = db.reference(f"/usuarios_institucionais/{uid}")
        user_data = user_ref.get()

        if not user_data:
            legacy_ref = db.reference(f"/users/{uid}")
            legacy_data = legacy_ref.get()
            if not legacy_data: return False, "Usuário não encontrado."

            acquired = legacy_data.get("acquiredSystems", [])

            if isinstance(acquired, str):
                sistemas_legado = [acquired.strip().lower()]
            elif isinstance(acquired, list):
                sistemas_legado = [str(s).strip().lower() for s in acquired]
            else:
                sistemas_legado = []
            if sistema.lower() in sistemas_legado or "tricalc" in sistemas_legado:
                 return True, "Licença legada válida!"
            return False, f"Sistema {sistema} não adquirido."

        if str(user_data.get("status")).strip().lower() != "ativo":
            return False, "Conta inativa."

        sistemas = user_data.get("sistemasAcesso", [])
        if isinstance(sistemas, dict): sistemas = list(sistemas.values())
        if isinstance(sistemas, str): sistemas = sistemas.split(",")
        sistemas_limpos = [str(s).strip().lower() for s in sistemas]

        if sistema.lower() not in sistemas_limpos:
            return False, f"Sem acesso ao sistema {sistema}."

        return True, "Licença válida!"
    except Exception as e:
        return False, str(e)


# ==============================================================================
# 1. LÓGICA: MapIA (Heurística de Mapeamento de Sala)
# (Protege os pesos, prioridades e cálculo de distância de Manhattan)
# ==============================================================================
def manhattan_distance(r1, c1, r2, c2):
    return abs(r1 - r2) + abs(c1 - c2)

def is_near(r, c, cells_set, radius=1):
    for cr, cc in cells_set:
        if manhattan_distance(r, c, cr, cc) <= radius: return True
    return False

@app.route('/mapia/gerar', methods=['POST'])
def gerar_mapia():
    data = request.get_json()
    auth = data.get('auth', {})
    sucesso, msg = validar_licenca(auth.get('uid'), "mapia")
    if not sucesso: return jsonify({'sucesso': False, 'mensagem': msg}), 403

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

    # PROPRIEDADE INTELECTUAL: Pesos do algoritmo
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

            # PROPRIEDADE INTELECTUAL: Lógica de Pontuação Especial
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
                        if dist == 1: score -= 5000  # Punição severa por sentar perto do grupo de conversa
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

    return jsonify({'sucesso': True, 'arrangement': arr})


# ==============================================================================
# 2. LÓGICA: RemanejIA (Otimização de Enturmação)
# (Protege a lógica de clusterização e balanceamento de Gênero/Nível)
# ==============================================================================
@app.route('/remanejia/gerar', methods=['POST'])
def gerar_remanejia():
    data = request.get_json()
    auth = data.get('auth', {})
    sucesso, msg = validar_licenca(auth.get('uid'), "remanejia")
    if not sucesso: return jsonify({'sucesso': False, 'mensagem': msg}), 403

    students = data.get('students', [])
    num_classes = int(data.get('numClasses', 3))
    priorities = data.get('priorities', {})

    if not students: return jsonify({'sucesso': False, 'mensagem': 'Sem alunos.'}), 400

    wMand = 3 if priorities.get('pMand') else 1
    wPref = 3 if priorities.get('pPref') else 1
    wBal = 3 if priorities.get('pBal') else 1

    ideal_size = len(students) / num_classes
    total_f = sum(1 for s in students if s.get('gender') == 'F')
    ideal_f = total_f / num_classes

    best_config = None
    best_score = -float('inf')
    best_metrics = None

    # PROPRIEDADE INTELECTUAL: Algoritmo Guloso Aleatório com Clusters
    for _ in range(50):
        current_classes = [[] for _ in range(num_classes)]
        queue = list(students)
        random.shuffle(queue)
        queue.sort(key=lambda x: len(x.get('constraints', [])), reverse=True)

        placed_ids = set()

        for s in queue:
            if s['id'] in placed_ids: continue

            # Agrupa as obrigações (MUST)
            cluster = [s]
            for c in s.get('constraints', []):
                if c['type'] == 'must' and c['targetId'] not in placed_ids:
                    friend = next((x for x in students if x['id'] == c['targetId']), None)
                    if friend: cluster.append(friend)

            best_class_idx = -1
            max_score = -float('inf')

            indices = list(range(num_classes))
            random.shuffle(indices)

            for idx in indices:
                cls = current_classes[idx]

                # Regra Rígida: CANNOT
                conflict = False
                for member in cluster:
                    enemies = [c['targetId'] for c in member.get('constraints', []) if c['type'] == 'cannot']
                    if any(x['id'] in enemies for x in cls):
                        conflict = True
                        break
                if conflict: continue

                # Função de Pontuação
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

        # Calcula Métricas
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
        std_dev = math.sqrt(sum((x - avg_s)**2 for x in sizes) / len(sizes)) if sizes else 0

        s_man = 100 if (man_total + can_tot) == 0 else (((man_met + (can_tot - can_viol)) / (man_total + can_tot)) * 100)
        s_pref = 100 if pref_total == 0 else ((pref_met / pref_total) * 100)
        s_bal = max(0, 100 - (std_dev * 20))

        final_score = ((s_man * wMand) + (s_pref * wPref) + (s_bal * wBal)) / (wMand + wPref + wBal)

        if final_score > best_score:
            best_score = final_score
            best_config = current_classes
            best_metrics = {
                "totalScore": final_score, "mandatoryPct": s_man, "preferPct": s_pref, "balancePct": s_bal,
                "stats": {"mandatoryMet": man_met, "mandatoryTotal": man_total, "preferMet": pref_met, "preferTotal": pref_total, "cannotViolated": can_viol, "cannotTotal": can_tot}
            }

    return jsonify({'sucesso': True, 'classes': best_config, 'metrics': best_metrics})


# ==============================================================================
# 3. LÓGICA: AvalIA (Triagem Pedagógica e Relatório Clínico/Escolar)
# (Protege os textos das recomendações e os limites de pontuação)
# ==============================================================================
# PROPRIEDADE INTELECTUAL: Textos de recomendação pedagógica e réguas clínicas
RECOMENDACOES_AVALIA = {
    'tea': {
        'baixo': "Continue observando e oferecendo um ambiente acolhedor. Não há indícios significativos no momento.",
        'moderado': ["Utilizar apoios visuais (quadros de rotina).", "Oferecer instruções claras e curtas.", "Proporcionar um espaço tranquilo para autorregulação.", "Incentivar interações sociais mediadas."],
        'alto': ["Implementar rotinas visuais e previsíveis.", "Antecipar mudanças na rotina de forma clara.", "Adaptar o ambiente para minimizar sobrecargas sensoriais (luz/som).", "Utilizar os interesses restritos do aluno como porta de entrada para o aprendizado.", "É fortemente sugerido discutir as observações com a coordenação e a família para um possível encaminhamento neuropsicológico."]
    },
    'tdah': {
        'baixo': "Manter um ambiente organizado com rotinas claras. O aluno demonstra agitação típica da idade.",
        'moderado': ["Dividir tarefas longas em etapas menores.", "Permitir pequenas pausas motoras ou movimentos direcionados.", "Posicionar o aluno longe de janelas ou portas (distrações).", "Usar reforço positivo imediato."],
        'alto': ["Estabelecer um sistema de recompensas claro de curto prazo.", "Utilizar organizadores gráficos e checklists para autonomia.", "Combinar instruções verbais com escritas no quadro.", "Proporcionar atividades de alta energia intercaladas.", "É fortemente sugerido discutir as observações com a família para avaliação neurológica."]
    },
    'di': {
        'baixo': "Garantir instruções claras e oferecer ajuda. O ritmo de aprendizagem está dentro do esperado.",
        'moderado': ["Usar materiais concretos e exemplos práticos da vida real.", "Repetir instruções pedir para o aluno explicar com as próprias palavras.", "Oferecer tempo estendido para avaliações.", "Focar primeiramente em habilidades funcionais."],
        'alto': ["Elaborar um Plano de Ensino Individualizado (PEI) urgente.", "Trabalhar em colaboração íntima com o profissional do AEE.", "Dividir o aprendizado em passos mínimos (análise de tarefas).", "Utilizar reforço positivo constante para evitar frustração extrema.", "É fortemente sugerido encaminhamento multidisciplinar."]
    },
    'ah': {
        'baixo': "Incentivar a curiosidade natural e oferecer desafios de acordo com o currículo.",
        'moderado': ["Oferecer atividades de aprofundamento (não apenas 'mais do mesmo').", "Promover projetos independentes que permitam criatividade.", "Permitir que o aluno avance no conteúdo em seu próprio ritmo em momentos específicos.", "Incentivar participação em feiras ou olimpíadas de conhecimento."],
        'alto': ["Desenvolver estratégias formais de enriquecimento curricular.", "Facilitar o acesso a mentores em áreas de extremo interesse.", "Trabalhar o desenvolvimento socioemocional, pois pode haver dissimetria (maturidade intelectual alta, maturidade emocional imatura).", "Discutir programas de aceleração escolar com a coordenação e família."]
    },
    'dislexia': {
        'baixo': "Estar atento às etapas normais de alfabetização e possíveis trocas de letras temporárias.",
        'moderado': ["Oferecer apoio individual na leitura.", "Usar fontes maiores e com maior espaçamento (ex: OpenDyslexic, Arial 14).", "Ler os enunciados de provas em voz alta para garantir que a dificuldade não mascare o conhecimento.", "Evitar expor o aluno a situações de leitura em voz alta não voluntária."],
        'alto': ["Utilizar abordagem fônica, multissensorial e explícita diariamente.", "Permitir o uso de tecnologias assistivas (leitores de tela, digitadores).", "Oferecer tempo extra significativo em provas.", "Valorizar a expressão e avaliação oral.", "Encaminhamento urgente para fonoaudiologia e psicopedagogia."]
    },
    'discalculia': {
        'baixo': "Observar a relação do aluno com a matemática e oferecer reforço básico.",
        'moderado': ["Utilizar jogos de tabuleiro e atividades lúdicas para fixar numeração.", "Disponibilizar recursos visuais permanentemente (retas numéricas coladas na mesa, material dourado).", "Verificar a compreensão linguística dos enunciados dos problemas matemáticos.", "Valorizar o raciocínio, mesmo se o cálculo final estiver errado."],
        'alto': ["Usar materiais estritamente concretos e manipuláveis para ensinar conceitos abstratos.", "Permitir o uso de calculadora e tabela de tabuada em todas as avaliações.", "Dividir problemas matemáticos extensos em etapas de 1 linha.", "Relacionar toda a matemática com situações reais (dinheiro, tempo).", "Encaminhamento especializado."]
    },
    'tod': {
        'baixo': "Manter um vínculo empático e comunicação sempre não-violenta.",
        'moderado': ["Ignorar comportamentos de busca de atenção de baixa intensidade.", "Sempre elogiar publicamente e corrigir estritamente em particular.", "Antecipar e avisar previamente sobre situações que exigem mudança de atividade.", "Revisar as regras e garantir que o aluno entendeu os 'porquês'."],
        'alto': ["Manter a calma absoluta e nunca entrar em disputas de poder ou gritos.", "Estabelecer regras claríssimas, justas e com consequências lógicas e previsíveis.", "Oferecer duas opções aceitáveis para dar um falso senso de controle e autonomia.", "Validar os sentimentos de raiva antes de corrigir a ação.", "Trabalho urgente alinhado entre gestão escolar, família e psicologia externa."]
    }
}

@app.route('/avalia/gerar', methods=['POST'])
def gerar_avalia():
    data = request.get_json()
    auth = data.get('auth', {})
    sucesso, msg = validar_licenca(auth.get('uid'), "avalia")
    if not sucesso: return jsonify({'sucesso': False, 'mensagem': msg}), 403

    pontuacoes = data.get('pontuacoes', {})
    maximas = data.get('maximas', {})

    resultados_formatados = {}
    for codigo, pts in pontuacoes.items():
        max_pts = maximas.get(codigo, 30)
        percentual = (pts / max_pts) * 100 if max_pts > 0 else 0

        # PROPRIEDADE INTELECTUAL: Thresholds (Régua de corte)
        if percentual < 40: nivel, classe = 'Baixo', 'nivel-baixo'
        elif percentual <= 70: nivel, classe = 'Moderado', 'nivel-moderado'
        else: nivel, classe = 'Alto', 'nivel-alto'

        rec = RECOMENDACOES_AVALIA.get(codigo, {}).get(nivel.lower(), "")

        resultados_formatados[codigo] = {
            'nivel': nivel,
            'classeCSS': classe,
            'recomendacoes': rec
        }

    return jsonify({'sucesso': True, 'resultados': resultados_formatados})


# ==============================================================================
# 4. LÓGICA: SomatorIA (Cálculo de Notas e OpenCV Warp-Hunter)
# (Protege a matemática da soma binária, e a extração do gabarito)
# ==============================================================================
@app.route('/somatoria/calcular', methods=['POST'])
def somatoria_calcular():
    data = request.get_json()

    # 1. Validação de Licença
    auth = data.get('auth', {})
    if firebase_admin._apps:
        sucesso, msg = validar_licenca(auth.get('uid'), "somatoria")
        if not sucesso:
            return jsonify({'sucesso': False, 'mensagem': msg}), 403

    respostas = data.get('respostas', [])
    gabaritos = data.get('gabaritos', [])
    valores = data.get('valores', [])

    notas = []
    total = 0.0

    # ====================================================================
    # PROPRIEDADE INTELECTUAL: Lógica de acerto parcial Somatória (Bits)
    # Protegido no Servidor
    # ====================================================================
    for r, g, v in zip(respostas, gabaritos, valores):
        try:
            R = int(r)
            G = int(g)
            C = float(v)

            if R == G:
                nota = C # Acerto Total
            elif (R & G) == R and R > 0:
                # Acerto Parcial (Nenhuma alternativa errada assinalada)
                bits_R = bin(R).count("1")
                bits_G = bin(G).count("1")
                nota = (bits_R / bits_G) * C
            else:
                nota = 0.0 # Assinalou algo errado = zera a questão
        except:
            nota = 0.0

        nota = round(nota, 1)
        notas.append(nota)
        total += nota

    return jsonify({
        'sucesso': True,
        'notas': notas,
        'total': round(total, 1)
    })

# ==============================================================================
# 5. LÓGICA: TRI (Teoria de Resposta ao Item)
# (Protege Função Logística de 3 Parâmetros e Máxima Verossimilhança)
# ==============================================================================
SAEB_MEAN, SAEB_SD = 250.0, 50.0

def probability_3pl(theta, a, b, c):
    try:
        exp_val = max(-35.0, min(35.0, -1.702 * float(a) * (float(theta) - float(b))))
        return float(c) + (1.0 - float(c)) / (1.0 + math.exp(exp_val))
    except: return float('nan')

def log_likelihood(theta, responses, items):
    ll = 0.0
    for r, item in zip(responses, items):
        if r not in (0, 1): continue
        p = probability_3pl(theta, item['a'], item['b'], item['c'])
        if math.isnan(p) or p <= 0.0 or p >= 1.0: return float('-inf')
        ll += math.log(p) if r == 1 else math.log(1.0 - p)
    return ll if math.isfinite(ll) else float('-inf')

def estimate_theta(responses, items):
    valid_responses = [r for r in responses if r in (0, 1)]
    if not valid_responses: return float('nan')
    soma_acertos = sum(valid_responses)
    if soma_acertos == 0: return -4.0
    if soma_acertos == len(valid_responses): return 4.0

    best_theta, max_ll = float('nan'), float('-inf')
    theta = -4.0
    while theta <= 4.0:
        ll = log_likelihood(theta, responses, items)
        if ll > max_ll: max_ll, best_theta = ll, theta
        theta += 0.01
    return best_theta

@app.route('/tri/analise', methods=['POST'])
def analise_tri():
    data = request.get_json()
    auth = data.get('auth', {})
    sucesso, msg = validar_licenca(auth.get('uid'), "tri")
    if not sucesso: return jsonify({'sucesso': False, 'mensagem': msg}), 403

    items = data.get('items', [])
    students = data.get('students', [])

    # PROPRIEDADE INTELECTUAL: Calibração Heurística de Itens
    item_stats = [{'acertos': 0, 'count': 0} for _ in items]
    for s in students:
        for i, r in enumerate(s['responses']):
            if r in (0, 1):
                item_stats[i]['count'] += 1
                if r == 1: item_stats[i]['acertos'] += 1

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

    return jsonify({
        'sucesso': True,
        'items_calibrados': calibrated_items,
        'scores': scores_dict,
        'avgSaeb': round(total_saeb / valid_saeb_count, 2) if valid_saeb_count > 0 else None
    })

# ==============================================================================
# ROTAS API - HORÁRIOS
# ==============================================================================

@app.route('/otimizar_janelas', methods=['POST'])
def otimizar_janelas():
    data = request.get_json()
    if not data: return jsonify({'sucesso': False, 'mensagem': 'Dados inválidos'}), 400
    resultado = executar_logica_horario(data, modo='otimizar_janelas')
    return jsonify(resultado)

@app.route('/balancear_carga', methods=['POST'])
def balancear_carga():
    data = request.get_json()
    if not data: return jsonify({'sucesso': False, 'mensagem': 'Dados inválidos'}), 400
    resultado = executar_logica_horario(data, modo='balancear_carga')
    return jsonify(resultado)

@app.route('/alocar_ha', methods=['POST'])
def alocar_ha():
    data = request.get_json()
    if not data: return jsonify({'sucesso': False, 'mensagem': 'Dados inválidos'}), 400
    resultado = executar_logica_horario(data, modo='alocar_ha')
    return jsonify(resultado)

@app.route('/otimizar_dias', methods=['POST'])
def otimizar_dias():
    data = request.get_json()
    if not data: return jsonify({'sucesso': False, 'mensagem': 'Dados inválidos'}), 400
    # Agora a otimização de dias passa pelo motor principal que respeita TODAS as restrições!
    resultado = executar_logica_horario(data, modo='reduzir_dias')
    return jsonify(resultado)

# ------------------------------------------------------------------------------
# ROTAS DA API
# ------------------------------------------------------------------------------

@app.route('/gerar_horario', methods=['POST'])
def gerar_horario():
    data = request.get_json()
    if not data:
        return jsonify({'sucesso': False, 'mensagem': 'Dados inválidos'}), 400
    auth = data.get('auth', {})
    uid, email = auth.get('uid'), auth.get('email')
    sucesso, mensagem_diagnostico = validar_licenca(uid, "horia")
    if firebase_admin._apps and not sucesso:
        return jsonify({'sucesso': False, 'mensagem': 'Licença expirada. ' + mensagem_diagnostico}), 403
    resultado = executar_logica_horario(data, modo='gerar_padrao')
    return jsonify(resultado)

def processar_requisicao_horario(req, modo):
    start_time = time.time()
    try:
        data = req.json
        if not data: return jsonify({'sucesso': False, 'mensagem': 'JSON vazio.'}), 400

        auth = data.get('auth', {})
        if firebase_admin._apps and not validar_licenca(auth.get('uid'), auth.get('email')):
            return jsonify({'sucesso': False, 'mensagem': 'Licença expirada.'}), 403

        resultado = executar_logica_horario(data, modo=modo)

        duration = time.time() - start_time
        if resultado['sucesso']:
            resultado['mensagem'] += f"\n(Tempo: {duration:.2f}s)"
        return jsonify(resultado)

    except Exception as e:
        print("ERRO:", traceback.format_exc())
        return jsonify({'sucesso': False, 'mensagem': f'Erro interno: {str(e)}'}), 500

# ==============================================================================
# LÓGICA DO HORÁRIO (UNIFICADA COM SUPORTE A TODAS AS REGRAS)
# ==============================================================================

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
                if not aulas_structure: continue
                try: d = int(d_key)
                except: continue
                iter_aulas = enumerate(aulas_structure) if isinstance(aulas_structure, list) else aulas_structure.items()
                for a_key, materia_nome in iter_aulas:
                    if not materia_nome: continue
                    try:
                        a = int(a_key)
                        slot = day_aula_to_slot.get((d, a))
                        if slot is not None:
                            restricoes_fixas[(turma_nome, materia_nome)].append(slot)
                    except: continue

    # Apenas se o objetivo for EXCLUSIVAMENTE 'alocar_ha', congelamos o horário base inteiro.
    # Para otimizar dias ou balancear carga, as aulas precisam ficar livres para se reajustarem (respeitando as regras).
    if modo in ('alocar_ha',) and horario_base:
        base_turmas = horario_base.get('horarios_turmas', {})
        for turma_nome, grid in base_turmas.items():
            for d, dia_aulas in enumerate(grid):
                for a, conteudo_celula in enumerate(dia_aulas):
                    if not conteudo_celula: continue
                    partes = conteudo_celula.split('\n')
                    materia_nome = partes[0].strip()
                    if materia_nome in ('HA', 'Hora-Atividade'): continue
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
        if not prof_nome: continue
        professores_nomes.add(prof_nome)
        prof_geminada_prefs[prof_nome] = prof.get('aulas_geminadas', 'indiferente').lower()
        prof_ha_geminada_prefs[prof_nome] = prof.get('ha_geminada', 'indiferente').lower()

        disp_raw = prof.get('disponibilidade', [])
        if isinstance(disp_raw, list):
            for r, row in enumerate(disp_raw):
                if not isinstance(row, list): continue
                for c, status in enumerate(row):
                    if str(status).strip().upper() == 'DISPONÍVEL':
                        if r < num_aulas_dia and c < num_dias:
                            original_professor_availability_slots[prof_nome].add((c, r))
        if usa_ha:
            ha_raw = prof.get('disponibilidade_ha', [])
            if isinstance(ha_raw, list):
                for r, row in enumerate(ha_raw):
                    if not isinstance(row, list): continue
                    for c, status in enumerate(row):
                        if str(status).strip().upper() == 'DISPONÍVEL':
                            if r < num_aulas_dia and c < num_dias:
                                original_professor_ha_slots[prof_nome].add((c, r))

    # Construir lista de aulas
    all_lessons = []
    lesson_counter = 0
    for turma_nome, materias_turma in grade_data.items():
        if not isinstance(materias_turma, dict): continue
        for materia_nome, num_aulas in materias_turma.items():
            try: num_aulas = int(num_aulas)
            except: continue
            if num_aulas <= 0: continue
            prof_entry = prof_disc_data.get(turma_nome, {}).get(materia_nome, '')
            prof_nome = prof_entry if isinstance(prof_entry, str) else ''
            if not prof_nome: continue
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
            try: qtd_ha = int(prof.get('ha_qtd', 0))
            except:
                try: qtd_ha = int(prof.get('hora_atividade', 0))
                except: qtd_ha = 0
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

    # Processar regras personalizadas (AGORA SÃO APLICADAS MESMO OTIMIZANDO DIAS!)
    regras_bloqueio = [r for r in regras_personalizadas if r.get('tipo') == 'bloqueio_horario']
    regras_incompatibilidade = [{'turma': r.get('turma'), 'mat1': r.get('materia'), 'mat2': r.get('materia_2')}
                                for r in regras_personalizadas if r.get('tipo') == 'incompatibilidade']
    regras_limite = [r for r in regras_personalizadas if r.get('tipo') == 'limite_diario']
    regras_simultaneas = [r for r in regras_personalizadas if r.get('tipo') == 'aulas_simultaneas']

    # --------------------------------------------------------------------------
    # Função interna do modelo
    # --------------------------------------------------------------------------
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
                    unavail_array = prof_unavail_map.get(prof, [1]*num_slots_total)
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
            if not m1 or not m2: continue
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

        # 2. Turma AllDifferent (Sem sobreposição na mesma turma)
        turmas_list = [t['nome'] for t in turma_data]
        for turma in turmas_list:
            t_vars = [lesson_vars[l['id']] for l in all_lessons if l['turma'] == turma and l['id'] not in lessons_to_exclude_from_turma_alldiff]
            if len(t_vars) > 1:
                model.AddAllDifferent(t_vars)

        # 3. Professor AllDifferent (Sem professor em dois lugares ao mesmo tempo)
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
                    if l['turma'] != turma: continue
                    if filtro_materia and l['materia'] != filtro_materia: continue
                    if excecao_materia and l['materia'] == excecao_materia: continue
                    if l['id'] in lessons_to_exclude_from_turma_alldiff: continue
                    ids_para_somar.append(l['id'])
                if not ids_para_somar: continue
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
                s2 = day_aula_to_slot[(d, a+1)]
                valid_doubles.append((s1, s2))
                valid_doubles.append((s2, s1))
        for (t, m), ids in grouped.items():
            if len(ids) < 2: continue
            prof = next((l['prof'] for l in all_lessons if l['id'] == ids[0]), '')
            pref = prof_geminada_prefs.get(prof, 'indiferente')
            if pref == 'sim':
                sorted_ids = sorted(ids, key=lambda x: next(l['instance'] for l in all_lessons if l['id']==x))
                for k in range(0, len(sorted_ids)-1, 2):
                    model.AddAllowedAssignments([lesson_vars[sorted_ids[k]], lesson_vars[sorted_ids[k+1]]], valid_doubles)
            elif pref == 'não':
                for i in range(len(ids)):
                    for j in range(i+1, len(ids)):
                        model.AddForbiddenAssignments([lesson_vars[ids[i]], lesson_vars[ids[j]]], valid_doubles)

        # 6. Geminação HA
        for prof, ha_ids in ha_lessons_by_prof.items():
            if len(ha_ids) < 2: continue
            pref = prof_ha_geminada_prefs.get(prof, 'indiferente')
            if pref == 'sim':
                sorted_ids = sorted(ha_ids)
                for k in range(0, len(sorted_ids)-1, 2):
                    model.AddAllowedAssignments([lesson_vars[sorted_ids[k]], lesson_vars[sorted_ids[k+1]]], valid_doubles)
            elif pref == 'não':
                for i in range(len(ha_ids)):
                    for j in range(i+1, len(ha_ids)):
                        model.AddForbiddenAssignments([lesson_vars[ha_ids[i]], lesson_vars[ha_ids[j]]], valid_doubles)

        # 7. Bloqueio de Horários
        for regra in regras_bloqueio:
            filtro_turma = regra.get('turma')
            filtro_materia = regra.get('materia')
            filtro_prof = regra.get('professor')
            licoes_afetadas = []
            for l in full_lessons_list:
                if filtro_turma and l.get('turma') != filtro_turma: continue
                if filtro_materia and l.get('materia') != filtro_materia: continue
                if filtro_prof and l.get('prof') != filtro_prof: continue
                licoes_afetadas.append(l['id'])
            if not licoes_afetadas: continue
            regra_dia = regra.get('dia_indice')
            regra_aula = regra.get('aula_indice')
            dias_alvo = range(num_dias) if regra_dia is None or regra_dia == "" else [int(regra_dia)]
            aulas_alvo = range(num_aulas_dia) if regra_aula is None or regra_aula == "" else [int(regra_aula)]
            slots_proibidos = []
            for d in dias_alvo:
                for a in aulas_alvo:
                    s = day_aula_to_slot.get((d, a))
                    if s is not None: slots_proibidos.append(s)
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
            if not turma_alvo or not mat1 or not mat2: continue
            ids_m1 = grouped.get((turma_alvo, mat1), [])
            ids_m2 = grouped.get((turma_alvo, mat2), [])
            if not ids_m1 or not ids_m2: continue
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

        # Se o objetivo for janelas, carga ou dias, precisamos calcular os dias trabalhados e carga diária.
        if objetivo in ('min_janelas', 'balancear_carga', 'reduzir_dias'):
            for prof, l_ids in lessons_by_prof.items():
                if not l_ids: continue
                valid_slots_prof = set(prof_teaching_domains.get(prof, []))
                for d in range(num_dias):
                    day_global_slots = []
                    for a in range(num_aulas_dia):
                        s_global = day_aula_to_slot.get((d, a))
                        if s_global is not None and s_global in valid_slots_prof:
                            day_global_slots.append(s_global)
                    if not day_global_slots: continue
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

            # Aplicação das Objetivos
            if objetivo == 'min_janelas':
                if gap_vars_total or working_days_total:
                    model.Minimize(sum(gap_vars_total) * 100 + sum(working_days_total) * 5)
            elif objetivo == 'balancear_carga':
                if balance_penalties:
                    model.Minimize(sum(balance_penalties))
            elif objetivo == 'reduzir_dias':
                if working_days_total:
                    # Foca exclusivamente em minimizar os dias de trabalho, respeitando TODAS as regras.
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

# ------------------------------------------------------------------------------
# DIAGNÓSTICOS PARA O USUÁRIO
# ------------------------------------------------------------------------------
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
                    s2 = day_aula_to_slot.get((d, a+1))
                    if s1 in slots_disponiveis and s2 in slots_disponiveis:
                        pares_consecutivos += 1
            aulas_prof = [l for l in full_lessons_list if l['prof'] == prof and l['type'] == 'AULA']
            grupos = defaultdict(list)
            for l in aulas_prof:
                grupos[(l['turma'], l['materia'])].append(l)
            pares_necessarios = sum(len(ids)//2 for ids in grupos.values())
            if pares_consecutivos < pares_necessarios:
                sugestoes.append(f"  - Professor {prof} precisa de {pares_necessarios} pares geminados, mas só há {pares_consecutivos} horários consecutivos disponíveis.")

    # 4. Incompatibilidades inviáveis
    for regra in regras_incompatibilidade:
        turma_alvo = regra.get('turma')
        mat1 = regra.get('materia')
        mat2 = regra.get('materia_2')
        if not turma_alvo or not mat1 or not mat2:
            continue
        aulas1 = sum(1 for l in full_lessons_list if l['turma'] == turma_alvo and l['materia'] == mat1)
        aulas2 = sum(1 for l in full_lessons_list if l['turma'] == turma_alvo and l['materia'] == mat2)
        if aulas1 + aulas2 > num_dias:
            sugestoes.append(f"  - Incompatibilidade: {mat1} e {mat2} na turma {turma_alvo} totalizam {aulas1+aulas2} aulas, mas só há {num_dias} dias para separá-las.")

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
            if l['type'] != 'AULA': continue
            if l['turma'] != filtro_turma: continue
            if filtro_materia and l['materia'] != filtro_materia: continue
            if excecao and l['materia'] == excecao: continue
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)