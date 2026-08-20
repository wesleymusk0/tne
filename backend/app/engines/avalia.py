"""AvalIA — triagem pedagógica e relatório clínico/escolar.

Port 1:1 da lógica legada (server.py /avalia/gerar): réguas de corte e
textos de recomendação pedagógica. Não alterar limites nem textos sem
autorização explícita.
"""

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


def gerar_triagem(data):
    pontuacoes = data.get('pontuacoes', {})
    maximas = data.get('maximas', {})

    resultados_formatados = {}
    for codigo, pts in pontuacoes.items():
        max_pts = maximas.get(codigo, 30)
        percentual = (pts / max_pts) * 100 if max_pts > 0 else 0

        if percentual < 40:
            nivel, classe = 'Baixo', 'nivel-baixo'
        elif percentual <= 70:
            nivel, classe = 'Moderado', 'nivel-moderado'
        else:
            nivel, classe = 'Alto', 'nivel-alto'

        rec = RECOMENDACOES_AVALIA.get(codigo, {}).get(nivel.lower(), "")

        resultados_formatados[codigo] = {
            'nivel': nivel,
            'classeCSS': classe,
            'recomendacoes': rec
        }

    return {'sucesso': True, 'resultados': resultados_formatados}
