from weasyprint import HTML, CSS
from datetime import datetime

# ==========================================
# CONFIGURAÇÕES GERAIS
# ==========================================
data_geracao = datetime.now().strftime("%d/%m/%Y")
versao_sistema = "2.3.0" # Baseado nas libs importadas e features
nome_sistema = "HorIA"
empresa = "Systematrix Soluções Escolares"

# ==========================================
# CSS (ESTILIZAÇÃO - Identidade Visual HorIA)
# ==========================================
css_style = """
@page {
    size: A4;
    margin: 2.5cm;
    @bottom-center {
        content: "Página " counter(page);
        font-family: 'Helvetica', sans-serif;
        font-size: 9pt;
        color: #6b7280;
    }
    @bottom-right {
        content: "Manual do Usuário - HorIA";
        font-family: 'Helvetica', sans-serif;
        font-size: 8pt;
        color: #9ca3af;
    }
}

@page :first {
    @bottom-center { content: none; }
    @bottom-right { content: none; }
    background-color: #f3f4f6; /* Cor de fundo do app */
}

body {
    font-family: 'Helvetica', 'Arial', sans-serif;
    color: #374151; /* --primary do CSS original */
    line-height: 1.5;
    font-size: 11pt;
}

/* Capa */
.cover-container {
    text-align: center;
    padding-top: 25%;
}

.cover-icon {
    font-size: 80pt;
    color: #374151;
    margin-bottom: 20px;
}

.cover-title {
    font-size: 42pt;
    font-weight: bold;
    color: #374151;
    margin-bottom: 10px;
    letter-spacing: -1px;
}

.cover-subtitle {
    font-size: 16pt;
    color: #6b7280; /* --secondary */
    margin-bottom: 60px;
}

.cover-meta {
    margin-top: 120px;
    font-size: 10pt;
    color: #6b7280;
    border-top: 1px solid #d1d5db;
    padding-top: 20px;
    width: 60%;
    margin-left: auto;
    margin-right: auto;
}

/* Conteúdo */
h1 {
    color: #111827;
    border-bottom: 4px solid #374151;
    padding-bottom: 8px;
    margin-top: 0;
    font-size: 22pt;
    page-break-after: avoid;
}

h2 {
    color: #374151;
    font-size: 15pt;
    margin-top: 25px;
    margin-bottom: 12px;
    background-color: #e5e7eb;
    padding: 8px 12px;
    border-radius: 4px;
    page-break-after: avoid;
}

h3 {
    color: #4b5563;
    font-size: 12pt;
    margin-top: 18px;
    margin-bottom: 5px;
    font-weight: bold;
    border-left: 4px solid #0dcaf0; /* Cor de destaque Bootstrap Info */
    padding-left: 8px;
}

p { margin-bottom: 10px; text-align: justify; }
ul, ol { margin-bottom: 15px; padding-left: 25px; }
li { margin-bottom: 4px; }

/* Caixas de Texto */
.box {
    padding: 12px;
    border-radius: 6px;
    margin: 15px 0;
    font-size: 10pt;
    page-break-inside: avoid;
}

.box-info {
    background-color: #f0f9ff;
    border-left: 4px solid #0dcaf0;
    color: #0c5460;
}

.box-warning {
    background-color: #fff3cd;
    border-left: 4px solid #ffc107;
    color: #856404;
}

.box-tip {
    background-color: #d1e7dd;
    border-left: 4px solid #198754;
    color: #0f5132;
}

/* Elementos de UI Simulados */
.ui-btn {
    display: inline-block;
    padding: 2px 8px;
    background-color: #374151;
    color: white;
    border-radius: 4px;
    font-size: 8pt;
    font-weight: bold;
    font-family: monospace;
    vertical-align: middle;
}

.ui-tab {
    font-family: monospace;
    font-weight: bold;
    background-color: #f3f4f6;
    border: 1px solid #d1d5db;
    padding: 2px 5px;
    border-radius: 3px;
    color: #374151;
}

.page-break { page-break-before: always; }

/* Tabelas */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    font-size: 9pt;
}
th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
th { background-color: #f9fafb; color: #374151; font-weight: bold; }
"""

# ==========================================
# CONTEÚDO HTML
# ==========================================
html_content = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
</head>
<body>

    <!-- CAPA -->
    <div class="cover-container">
        <div class="cover-icon">&#129504;</div> <!-- Ícone Brain/Cérebro -->
        <div class="cover-title">{nome_sistema}</div>
        <div class="cover-subtitle">Gestão Inteligente de Horários</div>
        
        <div class="cover-meta">
            <p><strong>Desenvolvido por:</strong> {empresa}</p>
            <p><strong>Data do Documento:</strong> {data_geracao}</p>
            <p><strong>Versão:</strong> {versao_sistema}</p>
        </div>
    </div>

    <div class="page-break"></div>

    <!-- 1. ACESSO -->
    <h1>1. Acesso e Segurança</h1>
    <p>O <strong>HorIA</strong> é um sistema baseado em nuvem protegido por autenticação Firebase. O sistema possui um gerenciador de contas inteligente.</p>

    <h3>Tela de Login (SSO)</h3>
    <p>Ao acessar o sistema, você verá a tela de gerenciamento de contas.</p>
    <ul>
        <li><strong>Contas Salvas:</strong> O sistema memoriza e-mails utilizados anteriormente para facilitar o login. Basta clicar na conta desejada e inserir a senha.</li>
        <li><strong>Nova Conta:</strong> Clique em <span class="ui-btn">Usar outra conta</span> para fazer login com um novo e-mail.</li>
        <li><strong>Remover Conta:</strong> Clique no "X" vermelho ao lado de um e-mail salvo para esquecê-lo neste dispositivo.</li>
    </ul>

    <div class="box-info">
        <strong>Nota:</strong> Se o seu perfil não tiver o sistema "HorIA" ativado na licença da Systematrix, o acesso será bloqueado automaticamente.
    </div>

    <!-- 2. CONFIGURAÇÃO GERAL -->
    <h1>2. Configurações Iniciais</h1>
    <p>Após o login, a navegação é feita através de <strong>9 Abas Superiores</strong>. Comece sempre pela aba 1.</p>

    <h2>Aba 1. Geral</h2>
    <p>Define a estrutura macro da escola. Estas configurações afetam todas as outras abas.</p>
    <ul>
        <li><strong>Informações:</strong> Nome da Escola e Turno.</li>
        <li><strong>Tempos:</strong> Defina <em>Aulas/Dia</em> e <em>Dias/Semana</em>.</li>
        <li><strong>Horários:</strong> Preencha o horário de início de cada aula (ex: 07:00, 07:50).</li>
        <li><strong>Configurações Especiais:</strong>
            <ul>
                <li><strong>Utilizar Hora-Atividade (HA):</strong> Habilita colunas e grids extras para gestão de tempo de planejamento.</li>
        </li>
    </ul>
    <p>Clique em <span class="ui-btn">Salvar</span> para registrar as alterações.</p>

    <!-- 3. CADASTROS BÁSICOS -->
    <h1>3. Estrutura Pedagógica</h1>
    
    <h2>Aba 2. Turmas</h2>
    <p>Gerencie as classes (Ex: 6A, 7B, 3EM). Defina o nome e a meta de aulas (geralmente igual ao total de aulas da semana).</p>

    <h2>Aba 3. Matérias</h2>
    <p>Cadastre as disciplinas (Ex: Port, Mat, Hist). Certifique-se de não usar nomes duplicados.</p>

    <div class="page-break"></div>

    <!-- 4. PROFESSORES -->
    <h1>4. Gestão de Professores</h1>
    <p>A aba <span class="ui-tab">4. Professores</span> é o coração do sistema. Existem duas formas de alimentação:</p>

    <h3>A. Cadastro Manual</h3>
    <p>Ideal para ajustes finos ou escolas pequenas.</p>
    <ol>
        <li>Selecione ou crie um professor.</li>
        <li>Preencha a carga horária (Aulas e HA).</li>
        <li><strong>Geminadas:</strong> Indique se o professor prefere aulas duplas (Sim/Não/Indiferente).</li>
        <li><strong>Grids Interativos:</strong> Clique nas células para marcar indisponibilidade.
            <ul>
                <li>Grid <strong>AULA</strong>: Horários de lecionar.</li>
                <li>Grid <strong>HA</strong>: Use o botão <span class="ui-btn">Alternar p/ HA</span> para definir horários de planejamento.</li>
            </ul>
        </li>
    </ol>

    <h3>B. Cadastro via Link (Remoto)</h3>
    <p>Permite que os professores preencham seus próprios dados.</p>
    <div class="box-tip">
        <strong>Como usar:</strong>
        <ol>
            <li>No painel lateral direito, clique em <span class="ui-btn">Gerar Novo Link</span>.</li>
            <li>Configure a validade (horas) e o limite de usos.</li>
            <li><strong>Auto-Associação:</strong> Marque <em>"Ativar Preenchimento Automático"</em>. Isso permite que o professor selecione qual matéria leciona e em quais turmas, agilizando o preenchimento da aba 6 (Mapa).</li>
            <li>Copie e envie o link gerado aos docentes.</li>
        </ol>
    </div>

    <h4>Aprovação de Pendentes</h4>
    <p>Professores cadastrados via link aparecem na lista com uma etiqueta <span style="background:#ffc107; padding:2px; font-size:8pt; border-radius:3px;">Pendente</span>.</p>
    <ul>
        <li>Clique em <span class="ui-btn">Ver</span> para analisar a disponibilidade enviada.</li>
        <li>Ao <strong>Aprovar</strong>, se houver dados de Auto-Associação, o sistema tentará preencher o vínculo Professor/Matéria automaticamente, alertando em caso de conflito (sobrescrita).</li>
    </ul>

    <!-- 5. ASSOCIAÇÕES -->
    <h1>5. Definição da Grade</h1>

    <h2>Aba 5. Grade (Matriz Curricular)</h2>
    <p>Define <strong>QUANTAS</strong> aulas de cada matéria cada turma terá.</p>
    <ul>
        <li>Cruze a linha da Matéria com a coluna da Turma.</li>
        <li>O rodapé mostra o total de aulas cadastradas por turma.
            <ul>
                <li><span style="color:green; font-weight:bold;">Verde:</span> Total correto (bate com a configuração Geral).</li>
                <li><span style="color:red; font-weight:bold;">Vermelho:</span> Excesso de aulas.</li>
                <li><span style="color:orange; font-weight:bold;">Amarelo:</span> Falta aulas.</li>
            </ul>
        </li>
    </ul>

    <h2>Aba 6. Mapa (Prof x Disc)</h2>
    <p>Define <strong>QUEM</strong> dá cada aula.</p>
    <ul>
        <li>Selecione o professor responsável para cada cruzamento Turma/Matéria.</li>
        <li>Somente aparecem as matérias que possuem aulas definidas na aba 5.</li>
    </ul>

    <div class="page-break"></div>

    <!-- 6. RESTRIÇÕES E REGRAS -->
    <h1>6. Restrições e Regras</h1>
    <p>O HorIA processa três níveis de restrições para gerar o horário.</p>

    <h2>Nível 1: Fixar (Aba 7)</h2>
    <p>Use a aba <span class="ui-tab">7. Fixar</span> para "travar" aulas em posições imutáveis.</p>
    <ul>
        <li>Selecione a Turma.</li>
        <li>Na grade, escolha a matéria na célula desejada.</li>
        <li>O ícone de cadeado ficará verde (<span style="color:green">🔒</span>).</li>
        <li><em>Exemplo:</em> Fixar Educação Física na última aula de sexta-feira.</li>
    </ul>

    <h2>Nível 2: Regras Avançadas (Aba 8)</h2>
    <p>A aba <span class="ui-tab">8. Regras</span> permite criar lógica complexa:</p>
    
    <div class="box">
        <strong>Tipos de Regras Disponíveis:</strong>
        <ul>
            <li><strong>Bloqueio de Horário:</strong> Impede que uma Turma, Matéria ou Professor tenha aula em um dia/horário específico (similar à indisponibilidade, mas aplicado à turma).</li>
            <li><strong>Incompatibilidade:</strong> <em>"Se a turma tiver a Matéria A no dia, NÃO pode ter a Matéria B"</em>. Útil para evitar provas ou matérias pesadas no mesmo dia.</li>
            <li><strong>Limite Diário:</strong> Define o máximo de aulas de uma matéria por dia.
                <br><em>Feature exclusiva:</em> Você pode definir uma "Matéria de Exceção" que não conta para esse limite.</li>
        </ul>
    </div>

    <!-- 7. GERAÇÃO -->
    <h1>7. Geração e Resultados</h1>

    <h2>Aba 9. Gerar</h2>
    <p>Clique em <span class="ui-btn">Iniciar Geração</span>. O sistema processará os dados na nuvem.</p>

    <h3>Visualização dos Resultados</h3>
    <p>Após o sucesso, você pode alterar a visualização dos horários:</p>
    <ul>
        <li><strong>Horário:</strong> Exibe o horário de início (ex: 07:00).</li>
        <li><strong>Aula:</strong> Exibe o número da aula (ex: 1ª Aula).</li>
        <li><strong>Ambos:</strong> Exibe ambos os formatos combinados.</li>
    </ul>

    <h3>Otimização de Janelas</h3>
    <div class="box-warning">
        Após gerar um horário válido, aparecerá o botão <span class="ui-btn" style="background-color:#0dcaf0; border:none;">Otimizar Janelas</span>.
        Esta função executa um pós-processamento para tentar reduzir buracos na grade dos professores sem quebrar as regras principais.
    </div>

    <h3>Exportação PDF</h3>
    <p>Botões vermelhos geram relatórios para impressão:</p>
    <ul>
        <li><strong>PDF Turmas:</strong> Grade formatada para murais.</li>
        <li><strong>PDF Professores:</strong> Relatório individualizado.</li>
    </ul>

    <!-- 8. DADOS -->
    <h1>8. Gestão de Dados</h1>
    <p>Use a barra de navegação superior para segurança dos dados.</p>
    <table>
        <tr>
            <th width="30%">Botão</th>
            <th>Função</th>
        </tr>
        <tr>
            <td>Exportar JSON</td>
            <td>Baixa um arquivo de backup local (.json).</td>
        </tr>
        <tr>
            <td>Importar JSON</td>
            <td>Restaura um backup local.</td>
        </tr>
        <tr>
            <td>Exportar p/ banco</td>
            <td>Salva o estado atual na nuvem Firebase (Persistência).</td>
        </tr>
        <tr>
            <td>Importar do banco</td>
            <td>Recarrega a última versão salva na nuvem.</td>
        </tr>
    </table>

</body>
</html>
"""

# ==========================================
# GERAÇÃO DO PDF
# ==========================================
def gerar_manual():
    print(f"Iniciando geração do manual {nome_sistema}...")
    try:
        html = HTML(string=html_content)
        css = CSS(string=css_style)
        nome_arquivo = f"Manual_{nome_sistema}_v{versao_sistema}.pdf"
        
        html.write_pdf(target=nome_arquivo, stylesheets=[css])
        print(f"✅ Sucesso! Arquivo gerado: {nome_arquivo}")
    except Exception as e:
        print(f"❌ Erro ao gerar PDF: {e}")
        print("Certifique-se de ter o GTK+ instalado (se estiver no Windows) e a biblioteca WeasyPrint.")

if __name__ == "__main__":
    gerar_manual()