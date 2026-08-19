# AUDITORIA TNE — Inventário Completo da Versão Atual

> Fase 1 da TNE — Transformação da Nova Experiência.
> Documento produzido APENAS com leitura do repositório. Nenhum arquivo de código foi alterado.
> Este inventário é o **CHECKLIST OFICIAL DE REGRESSÃO**. Nenhum item pode desaparecer na nova versão.

Data da auditoria: 2026-08-19 · Commit base: `5abd87a first commit` (branch `main`)

---

## 1. DIAGNÓSTICO DA ARQUITETURA ATUAL

### 1.1 Visão geral

| Camada | Tecnologia atual | Local |
|---|---|---|
| Frontend | HTML + CSS + JS inline por módulo (sem build, sem framework) | `/{modulo}/index.html` (10 módulos) + 3 páginas institucionais |
| Backend | Python 3 / Flask monolítico (`server.py`, 1243 linhas) | PythonAnywhere: `https://systematrix.pythonanywhere.com` |
| Otimização | Google OR-Tools CP-SAT (HorIA) | dentro do `server.py` |
| Banco de dados | Firebase Realtime Database (projeto único atual: `systematrix-apps`) | RTDB |
| Autenticação | Firebase Authentication (apenas e-mail+senha) | projeto `systematrix-apps` |
| Serviços externos (fora do repo) | `bepis.systematrix.com.br` (criação de contas de professor), `ppc.systematrix.com.br` (checkout Mercado Pago), `create-preference.cartoonlandiapr.workers.dev` (checkout legado) | Cloudflare Workers / proxies |
| Pagamento | Mercado Pago via links curtos (`mpago.li`) + `init_point` gerado pelos workers | — |
| Manual | `manual.py` (weasyprint) gera PDF do manual do HorIA | repo |
| CRM | `zoho.js` com credenciais Zoho **hardcoded** (⚠️ segredo exposto) | repo |

### 1.2 Firebase — projetos identificados

| Projeto | Uso |
|---|---|
| `systematrix-apps` | **Atual**: todos os módulos ativos + backend (`FIREBASE_DB_URL`) |
| `map-ia`, `somatoria-2401`, `redaia0`, `escolarize-horarios`, `tricalc0` | **Legado**: apenas `index2.html` (landing antiga). Um projeto Firebase por produto |

### 1.3 Modelo de dados RTDB (raízes encontradas)

| Caminho | Conteúdo | Consumidores |
|---|---|---|
| `usuarios_institucionais/{uid}` | Perfil institucional: `instituicaoId`, `status`, `sistemasAcesso[]`, `nome` | todos os módulos, backend (`validar_licenca`), painel |
| `instituicoes/{id}/personalizacao` | Co-branding: logo, cor, layout de cabeçalho ProvIA | mapia, provia, remanejia, avalia, painel |
| `instituicoes/{id}/acquiredSystems` | Sistemas contratados pela instituição | painel |
| `admins_por_instituicao/{instituicaoId}` | UIDs dos gestores | mapia, remanejia |
| `professores_por_instituicao/{instituicaoId}` | Lista de professores da instituição | painel |
| `logs_atividades/{instituicaoId}` | Auditoria por instituição | painel, horia, mapia, remanejia |
| `users/{uid}` | **Legado**: usuário individual com `acquiredSystems[]` | mapia, remanejia, horia, somatoria, tricalc, backend |
| `dados_mapia/{uid}` | Dados MapIA por usuário | mapia |
| `dados_horia/{uid}` (+`temp_links`) | Dados HorIA por usuário + links de auto-cadastro | horia |
| `dados_somatoria/{uid}/templates` | Modelos de gabarito | somatoria |
| `dados_remanejia/{uid}` | Projeto RemanejIA por usuário (quiosque escreve aqui) | remanejia |
| `dados_tri/{uid}` | Dados do Simulador TRI | tricalc |
| `escolas/{uid}/config`, `escolas/{uid}/professores_pendentes` | **Modelo legado do HorIA** (a escola é uma conta de usuário) | horia |
| `horarios_publicos/{schoolUid}/{profId}` | Horário publicado por professor (visão pública/WhatsApp) | horia |
| `temp_links` | Índice global de links de auto-cadastro | horia |
| `config/manutencao` | Flag global de manutenção | mapia, somatoria, tricalc |
| `public/systematrix/emails/` | **Legado**: disponibilidade de username por produto | index2 |

⚠️ Observações críticas do modelo:
- Dados dos sistemas (`dados_*`) são por **usuário**, não por instituição → não há isolamento multi-tenant real hoje.
- Dois modelos convivem: institucional (`instituicoes/` + `usuarios_institucionais/`) e legado (`users/` + `escolas/{uid}`).
- Não foi possível auditar as **regras de segurança do RTDB** (estão no console Firebase, fora do repo) — PENDENTE.

### 1.4 Backend — rotas HTTP existentes

| ID | Rota | Função | Licença verificada |
|---|---|---|---|
| API-001 | `POST /mapia/gerar` | Geração de mapa de sala | `mapia` |
| API-002 | `POST /remanejia/gerar` | Otimização de enturmação | `remanejia` |
| API-003 | `POST /avalia/gerar` | Triagem pedagógica + recomendações | `avalia` |
| API-004 | `POST /somatoria/calcular` | Correção somatória binária | `somatoria` (só se Firebase ativo) |
| API-005 | `POST /tri/analise` | TRI 3PL + escala SAEB | `tri` |
| API-006 | `POST /gerar_horario` | Geração de horário (CP-SAT) | `horia` (só se Firebase ativo) |
| API-007 | `POST /otimizar_janelas` | Otimização de janelas | ❌ **sem verificação** |
| API-008 | `POST /balancear_carga` | Balanceamento de carga diária | ❌ **sem verificação** |
| API-009 | `POST /alocar_ha` | Alocação de Hora-Atividade | ❌ **sem verificação** |
| API-010 | `POST /otimizar_dias` | Redução de dias | ❌ **sem verificação** |
| API-011 | `validar_licenca(uid, sistema)` | Dual: institucional (`sistemasAcesso` + status ativo) ou legado (`users.acquiredSystems`; `tricalc` libera tudo) | — |
| API-012 | `processar_requisicao_horario(req, modo)` | ⚠️ **CÓDIGO MORTO**: definida mas nenhuma rota a usa; contém ainda bug (`validar_licenca(uid, email)` — email passado como `sistema`) | — |

---

## 2. INVENTÁRIO DE FUNCIONALIDADES (CHECKLIST DE REGRESSÃO)

Legenda de status: 🟢 funcional (aparente) · 🟡 parcial/risco · 🔴 quebrado/morto · ⚙️ backend/invisível

### 2.1 MapIA — mapa de sala (`mapia/index.html`, 1118 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| MAPIA-001 | Login e-mail+senha com seletor de contas salvas (SSO local) | `#login-view` | Firebase Auth + `localStorage: systematrixSSOAccounts_mapIA` | 🟢 |
| MAPIA-002 | Resolução de perfil institucional vs legado | script | `usuarios_institucionais` → fallback `users` | 🟢 |
| MAPIA-003 | Co-branding institucional (logo + cor) | `#institution-branding` | `instituicoes/{id}/personalizacao` | 🟢 |
| MAPIA-004 | Seção Geral (nome da escola e da turma no mapa) | `#section-geral` | local | 🟢 |
| MAPIA-005 | Grupos de alunos que conversam (criar/editar/excluir, mín. 2) | `#section-grupos` | local → payload | 🟢 |
| MAPIA-006 | Cadastro de alunos com 9 flags: TEA, TDAH, TOD, DI, visão, audição, PcD, estatura baixa, estatura alta | `#section-alunos` | local → payload | 🟢 |
| MAPIA-007 | Vínculo individual "conversa com" (grupo OU nome livre) | `#talks-with`, `#talks-with-text` | local → payload | 🟢 |
| MAPIA-008 | Edição/atualização de aluno + limpar formulário | `#update-student-btn` etc. | local | 🟢 |
| MAPIA-009 | Configuração de sala: N colunas, carteiras por coluna | `#section-config_sala` | local | 🟢 |
| MAPIA-010 | Pixel-grid: marcação de porta, mesa do professor, janela | `#pixel-grid` | local → payload | 🟢 |
| MAPIA-011 | Geração do mapa (heurística: pesos 1000/900/800/700/600/500, bônus/penalidades por proximidade porta/prof/janela, punição -5000 por sentar junto, distância Manhattan, shuffle + melhor score) | `#generate-map-btn` | `POST /mapia/gerar` | 🟢 |
| MAPIA-012 | Visualização do mapa (seat map A1..Nn) | `#result` | resposta API | 🟢 |
| MAPIA-013 | Salvar/carregar projeto na nuvem | botões | `dados_mapia/{uid}` | 🟢 |
| MAPIA-014 | Exportar imagem PNG (html2canvas) | `#save-map-img-btn` | client-side | 🟢 |
| MAPIA-015 | Exportar/importar JSON do projeto | `#file-input` | client-side | 🟢 |
| MAPIA-016 | Modo manutenção global (aviso 90s → banner → 3 períodos de 5min → bloqueio) | `#maintenance-overlay` | `config/manutencao` | 🟢 |
| MAPIA-017 | Log de atividade institucional | — | `logs_atividades/{instituicaoId}` | ⚙️ |

### 2.2 RemanejIA — enturmação (`remanejia/index.html`, 1422 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| REM-001 | Login SSO local + perfil institucional/legado + co-branding | `#login-view` | idem MapIA | 🟢 |
| REM-002 | Cadastro de alunos: matrícula, nome, turma de origem, gênero (M/F), nível (1–5) | `#student-list` | local | 🟢 |
| REM-003 | Importação Excel/CSV com auto-mapeamento de colunas (nome, genero/sexo, nivel/score/nota, turma) | `#excel_file` | SheetJS | 🟢 |
| REM-004 | Relações entre alunos: `must` (juntos), `cannot` (separados), `prefer` (preferência) | seção Relações | local | 🟢 |
| REM-005 | Quiosque: link público para alunos preencherem amigos/inimigos; campos configuráveis (exibir amigos/inimigos) | `#kioskLinkCard` | grava em `dados_remanejia/{kioskUid}` | 🟢 |
| REM-006 | Config: número de turmas + pesos de prioridade (obrigatórias/preferências/balanceamento) | Configurações | local | 🟢 |
| REM-007 | Geração (algoritmo guloso aleatório, 50 iterações, clusters MUST, regra rígida CANNOT, balanceamento tamanho+gênero, score final ponderado) | Gerar | `POST /remanejia/gerar` | 🟢 |
| REM-008 | Métricas da geração (score total, % obrigatórias, % preferências, % balanceamento, contagens) | resultado | resposta API | 🟢 |
| REM-009 | Salvar/carregar nuvem | botões | `dados_remanejia/{uid}` | 🟢 |
| REM-010 | Log de atividade institucional | — | `logs_atividades` | ⚙️ |

### 2.3 SomatorIA — correção por somatória (`somatoria/index.html`, 1291 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| SOM-001 | Login SSO local + co-branding | `#login-view` | Firebase Auth | 🟢 |
| SOM-002 | Correção manual: respostas × gabarito × valor por questão (grade editável) | aba Correção | `POST /somatoria/calcular` | 🟢 |
| SOM-003 | Lógica de acerto parcial binário: acerto total = valor; subconjunto correto = proporcional aos bits; qualquer bit errado = 0 | — | backend | 🟢 |
| SOM-004 | Ditado por voz do gabarito e das respostas (Web Speech API) | `#start-voice-*` | client-side | 🟢 |
| SOM-005 | Travamento do gabarito (lock) + limpar gabarito/limpar tudo | toolbar | local | 🟢 |
| SOM-006 | Modelos de gabarito: criar/editar/excluir/listar; nome, instituição, logo (base64), nº questões, valor padrão, alternativas (pesos binários configuráveis, ex. 1-2-4-8-16-32), modo bubbles/manual | aba Modelos | `dados_somatoria/{uid}/templates` | 🟢 |
| SOM-007 | Impressão do modelo de gabarito (layout próprio com âncoras magenta) | aba Modelos | client-side | 🟢 |
| SOM-008 | Scanner por câmera (getUserMedia, captura de foto) | aba Scanner | client-side | 🟢 |
| SOM-009 | "Motor Warp-Hunter v7.0": detecção de 4 âncoras magenta → warp bilinear 800×1100 → threshold de luma → snap-to-square → leitura de bolhas e modo manual (dígitos de dezena/unidade) | aba Scanner | client-side | 🟢 |
| SOM-010 | Correção automática pós-scan + relatório textual | aba Scanner | `POST /somatoria/calcular` | 🟢 |
| SOM-011 | Nome do aluno + texto de resultado (exportação/cópia) | `#result-text` | local | 🟢 |
| SOM-012 | Modo manutenção global | overlay | `config/manutencao` | 🟢 |

### 2.4 AvalIA — triagem pedagógica (`avalia/index.html`, 736 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| AVA-001 | Login SSO local + co-branding | `#login-view` | Firebase **v9 modular** (único módulo) | 🟡 (inconsistência de SDK) |
| AVA-002 | Questionário de triagem em 7 áreas: TEA (15q), TDAH (15q), DI (15q), AH/SD (15q), Dislexia (10q), Discalculia (10q), TOD (10q) | formulário | local | 🟢 |
| AVA-003 | Análise com réguas de corte (<40% Baixo, 40–70% Moderado, >70% Alto) | resultado | `POST /avalia/gerar` | 🟢 |
| AVA-004 | Recomendações pedagógicas proprietárias por área/nível (textos no backend) | relatório | backend `RECOMENDACOES_AVALIA` | 🟢 |
| AVA-005 | Relatório visual por área (cores por nível) | relatório | resposta API | 🟢 |

### 2.5 ProvIA — elaboração de provas (`provia/index.html`, 816 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| PROV-001 | Login SSO local + co-branding | `#login-view` | Firebase Auth | 🟢 |
| PROV-002 | Config da avaliação: instituição, tipo, bimestre/trimestre, valor total, professor, componente, série, turma | `#prova-creator` | local | 🟢 |
| PROV-003 | Questões objetivas (com alternativas) e dissertativas; valor individual; adicionar/excluir/reordenar (↑↓) | `#questoes-container` | local | 🟢 |
| PROV-004 | Adaptações de acessibilidade: TDAH/TEA (caixas separadas), Dislexia (OpenDyslexic), Baixa Visão (18pt, alto contraste) | `#prova-adaptacao` | local (render) | 🟢 |
| PROV-005 | Layout 1 ou 2 colunas (estilo ENEM) | seletor | local (render) | 🟢 |
| PROV-006 | Cabeçalho oficial da instituição (Layout construído no Painel Gestor) | render | `instituicoes/{id}/personalizacao` | 🟢 |
| PROV-007 | Geração da prova para impressão | `#visualizar-prova-btn` | client-side | 🟢 |

### 2.6 Simulador TRI (`tricalc/index.html`, 752 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| TRI-001 | Login SSO local + co-branding | `#login-view` | Firebase Auth | 🟢 |
| TRI-002 | Estrutura da prova: itens com parâmetros TRI (a, b, c) | aba 1 | local | 🟢 |
| TRI-003 | Importar itens via CSV | `#import-items-btn` | client-side | 🟢 |
| TRI-004 | Respostas dos alunos (matriz aluno×item) | aba 2 | local | 🟢 |
| TRI-005 | Importar respostas via CSV | `#import-responses-btn` | client-side | 🟢 |
| TRI-006 | Análise TRI 3PL: calibração heurística de itens sem a/b; theta por máxima verossimilhança (grade −4..4, passo 0.01); escala SAEB (média 250, DP 50, clamp 0–500) | aba 3 | `POST /tri/analise` | 🟢 |
| TRI-007 | Dashboard: média SAEB da turma | `#db-avg-saeb` | resposta API | 🟢 |
| TRI-008 | Histograma de distribuição de proficiências (Chart.js) | `#proficiency-histogram` | client-side | 🟢 |
| TRI-009 | Curva Característica do Item (CCI) | canvas | client-side | 🟢 |
| TRI-010 | Exportar resultados CSV + parâmetros calibrados CSV | botões | client-side | 🟢 |
| TRI-011 | Modo manutenção global | overlay | `config/manutencao` | 🟢 |

### 2.7 HorIA — grade de horários (`horia/index.html`, 1254 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| HORIA-001 | Login SSO local + perfil institucional/legado | `#login-screen` | Firebase Auth | 🟢 |
| HORIA-002 | Wizard em 10 abas: 1 Base · 2 Turmas · 3 Timeline · 4 Matérias · 5 Profs · 6 Grade · 7 Mapa · 8 Fixar · 9 Regras · 10 Gerar | tabs | `appData` local | 🟢 |
| HORIA-003 | Base: nome da escola, turno, aulas/dia, dias/semana, usa_ha | `#tab-geral` | local | 🟢 |
| HORIA-004 | Timeline: eventos e pausas por turma ocupando slots lógicos (substitui "recreios fixos") | `#tab-timeline` | `appData.timeline` | 🟢 |
| HORIA-005 | Migração de estruturas de dados antigas (expandGrid, remapeamento de slots, fixos) | script | client-side | 🟢 |
| HORIA-006 | Professores: grade de disponibilidade (DISPONÍVEL), nº de HAs, disponibilidade de HA, preferência de aulas geminadas e HA geminada | `#tab-professores` | local | 🟢 |
| HORIA-007 | Grade curricular: matéria × quantidade de aulas por turma | `#tab-grade` | local | 🟢 |
| HORIA-008 | Mapa de atribuição professor↔disciplina↔turma | `#tab-mapa` | `prof_disc` | 🟢 |
| HORIA-009 | Fixação manual de aulas em slots | `#tab-fixar` | `fixos` | 🟢 |
| HORIA-010 | Regras personalizadas: bloqueio_horario, incompatibilidade (matérias em dias diferentes), limite_diario, aulas_simultaneas (co-docência) | `#tab-regras` | `regras_personalizadas` | 🟢 |
| HORIA-011 | Geração CP-SAT: AllDifferent turma/professor, fixos, geminação sim/não, HA, restrições custom; fallback com relaxamento de disponibilidade (violações minimizadas); timeouts 20s/60s | `#tab-gerar` | `POST /gerar_horario` | 🟢 |
| HORIA-012 | Modos de otimização: otimizar_janelas, balancear_carga, alocar_ha, reduzir_dias | `#tab-gerar` | API-007..010 | 🟢 |
| HORIA-013 | Diagnóstico detalhado ao falhar (disponibilidade insuficiente, fixos conflitantes, geminação impossível, incompatibilidade inviável, limite excedido, HA sem slot) | mensagem | backend `gerar_sugestoes_detalhadas` | 🟢 |
| HORIA-014 | Resultado: visão por turma e por professor | `#res-turmas`/`#res-profs` | resposta API | 🟢 |
| HORIA-015 | Relatórios PDF (jsPDF+autotable): PDF por turma e por professor | Relatórios | client-side | 🟢 |
| HORIA-016 | Exportar/importar JSON + salvar/carregar nuvem | toolbar | `dados_horia/{uid}` | 🟢 |
| HORIA-017 | Links de auto-cadastro de professor (maxUses, usedCount, status) | aba Profs | `dados_horia/{uid}/temp_links` + `temp_links` | 🟢 |
| HORIA-018 | Fluxo do professor via link: escolhe matéria/turmas, disponibilidade, geminação, HA → vira pendente | `#teacher-register` | `escolas/{uid}/professores_pendentes` | 🟡 (modelo legado) |
| HORIA-019 | Aprovação/rejeição de professores pendentes | modal | `escolas/{uid}/professores_pendentes` | 🟡 (modelo legado) |
| HORIA-020 | Publicação de horário público por professor + visão pública via link (WhatsApp) | `#public-view-screen` | `horarios_publicos/{schoolUid}/{profId}` | 🟢 |
| HORIA-021 | Log de atividades | — | `logs_atividades/{schoolId}` | ⚙️ |
| HORIA-022 | ⚠️ BUG: concatenação `'/dados_horia' + schoolUid` (sem `/`) ao atualizar `usedCount`/`status` do link — grava em caminho errado | linha ~911 | — | 🔴 |
| HORIA-023 | Modelo dual de dados: legado `escolas/{uid}` convive com institucional | — | — | 🟡 |

### 2.8 Painel do Gestor (`painel/index.html`, 869 linhas)

| ID | Funcionalidade | Tela/Componente | Dados/Backend | Status |
|---|---|---|---|---|
| PAINEL-001 | Login do gestor + carregamento da instituição | login | `usuarios_institucionais/{uid}` → `instituicaoId` | 🟢 |
| PAINEL-002 | Resumo da instituição | `#inst-name-header` | `instituicoes/{id}` | 🟢 |
| PAINEL-003 | Personalização: logo, cor institucional | aba Personalização | `instituicoes/{id}/personalizacao` | 🟢 |
| PAINEL-004 | Construtor de layout do cabeçalho oficial de provas (ProvIA) | aba Personalização | `personalizacao` | 🟢 |
| PAINEL-005 | Cadastro de professor: nome, e-mail, **senha definida pelo gestor**, sistemas permitidos | aba Professores | worker `bepis.systematrix.com.br` (Bearer ID token) | 🟡 (prática de senha frágil) |
| PAINEL-006 | Edição de professor: nome, `sistemasAcesso`, status (ativo/inativo) | modal | `usuarios_institucionais/{uid}` | 🟢 |
| PAINEL-007 | Lista de professores com badges de sistemas | aba Professores | `professores_por_instituicao/{id}` | 🟢 |
| PAINEL-008 | Log de atividades da instituição | aba Logs | `logs_atividades/{id}` | 🟢 |
| PAINEL-009 | Sistemas disponíveis para atribuir derivados de `acquiredSystems` da instituição | checkboxes | `instituicoes/{id}/acquiredSystems` | 🟢 |

### 2.9 Sites institucionais / aquisição

| ID | Funcionalidade | Arquivo | Status |
|---|---|---|---|
| SITE-001 | Portal com segmentação professor/escola + WhatsApp flutuante + AdSense | `index.html` | 🟡 (modal de compra esvaziado — HTML/JS removidos; página só direciona) |
| SITE-002 | Landing B2C com 6 produtos (MapIA, RemanejIA, SomatorIA, HorIA, TRI, AvalIA) + checkout Mercado Pago via `ppc.systematrix.com.br` | `professores/index.html` | 🟢 |
| SITE-003 | Landing B2B com módulos (HorIA, RemanejIA, MapIA, ProvIA, SomatorIA, TRI, AvalIA) → WhatsApp comercial | `escolas/index.html` | 🟢 |
| SITE-004 | Landing legada completa: multi-Firebase por produto, produtos RedaIA/BiblIA/Cafezinho, planos mensal/anual, checagem de username, checkout worker legado | `index2.html` | 🟡 (legado ativo? — decidir) |
| SITE-005 | ⚠️ ProvIA NÃO aparece na landing B2C (só na B2B) | `professores/index.html` | 🟡 |

### 2.10 Plataforma / cross-cutting

| ID | Funcionalidade | Onde | Status |
|---|---|---|---|
| PLAT-001 | Modo manutenção global com fases | mapia, somatoria, tricalc | 🟢 |
| PLAT-002 | SSO local (multi-conta salva no dispositivo) | todos os módulos | 🟢 |
| PLAT-003 | Co-branding institucional (logo/cor/cabeçalho) | mapia, remanejia, provia, avalia, somatoria?, tricalc?, painel | 🟢 |
| PLAT-004 | Log de atividades por instituição | mapia, remanejia, horia, painel | 🟢 |
| PLAT-005 | Licença por sistema com dupla leitura (institucional + legado) | backend | 🟢 |
| PLAT-006 | Manual do usuário HorIA em PDF | `manual.py` | 🟢 |
| PLAT-007 | Recuperação de senha | — | 🔴 **inexistente** |
| PLAT-008 | Login Google / Microsoft | — | 🔴 **inexistente** |
| PLAT-009 | Multi-tenancy com isolamento | — | 🔴 **inexistente** (dados por usuário) |
| PLAT-010 | Gestão centralizada de alunos/turmas | — | 🔴 **inexistente** |
| PLAT-011 | Notas/Boletim/Presença/BuscIA/DomicilIA/Studio | — | 🔴 **inexistentes** (novos na TNE) |
| PLAT-012 | Painel administrativo global | — | 🔴 **inexistente** |
| PLAT-013 | Assinaturas com webhooks/upgrade/downgrade/tolerância | — | 🔴 **inexistente** (hoje: link de pagamento simples) |

---

## 3. PROBLEMAS ENCONTRADOS

### 3.1 Segurança (críticos primeiro)

1. 🔴 **`zoho.js` com CLIENT_ID, CLIENT_SECRET e REFRESH_TOKEN do Zoho CRM em texto claro no repositório.** Segredo exposto — precisa rotação + remoção do histórico.
2. 🔴 **Backend não verifica o ID token do Firebase.** `validar_licenca` confia no `uid` enviado pelo cliente no JSON. Qualquer pessoa pode invocar as rotas com o `uid` de um usuário licenciado.
3. 🔴 **Rotas `/otimizar_janelas`, `/balancear_carga`, `/alocar_ha`, `/otimizar_dias` sem nenhuma verificação de licença.**
4. 🟡 **CORS totalmente aberto** (`CORS(app)` sem restrição de origem).
5. 🟡 **Gestor define a senha do professor** (painel) — senha trafega e é conhecida por terceiro; sem troca obrigatória no primeiro acesso.
6. 🟡 Regras de segurança do RTDB desconhecidas (fora do repo) — pode haver leitura/escrita pública (o quiosque e `horarios_publicos` sugerem escrita/leitura sem auth).
7. 🟡 Credenciais de service account referenciadas por path fixo no servidor (`/home/systematrix/backend/...`).
8. 🟡 Chaves de API Firebase expostas no frontend (normal para Firebase, mas reforça a necessidade de regras RTDB corretas).
9. 🟡 AdSense + Cloudflare beacon na landing (tracking) — verificar LGPD/aviso de cookies.

### 3.2 Funcionais / bugs

1. 🔴 HORIA-022: bug de path (`/dados_horia` + uid sem barra) corrompe atualização de `usedCount`/`status` dos links de cadastro.
2. 🔴 API-012 `processar_requisicao_horario` é código morto com bug de assinatura.
3. 🟡 `index.html` (portal atual) contém `#purchase-modal` **vazio** e script esvaziado — resíduo quebrado.
4. 🟡 ProvIA ausente da vitrine B2C.
5. 🟡 `horia/server.txt` é cópia antiga do backend (deriva de config: path de credencial e licença legada diferentes).
6. 🟡 Inconsistência de SDK Firebase (v8 vs v9 no AvalIA).
7. 🟡 Inconsistência de nomenclatura: `instituicaoId` × `schoolId` × `schoolUid`; `instituicoes/` × `escolas/`.
8. 🟡 Sem persistência de provas (ProvIA) e questionários (AvalIA) por aluno — tudo em memória/local.

### 3.3 UX

1. Navegação entre sistemas inexistente — cada sistema é uma ilha (login separado por módulo, sem hub/dashboard).
2. SSO local exige redigitar senha (não há sessão unificada).
3. Responsividade parcial (grids do HorIA/MapIA pouco usáveis no celular).
4. `prompt()`/`alert()` nativos em fluxos-chave (RemanejIA grupos, confirmações).
5. Estados vazios/loading inconsistentes entre módulos.
6. Identidade visual divergente entre módulos (cores e tipografia diferentes por sistema).
7. Acessibilidade: sem aria-labels, contraste variável, navegação por teclado limitada.

### 3.4 Performance

1. `estimate_theta` varre 801 pontos × itens × alunos em Python puro — O(n·m·801) por requisição (aceitável hoje, mas sem cache/limite).
2. CP-SAT com timeout 20s/60s síncrono no request HTTP (sem fila/async) — risco de timeout de gateway em escolas grandes.
3. Scanner SomatorIA processa warp pixel-a-pixel em JS (800×1100) no main thread — trava UI em devices fracos.
4. Todos os assets via CDN (Firebase 8, Font Awesome, Bootstrap, jsPDF, Chart.js, html2canvas) sem SRI/bundling/cache próprio.
5. MapIA faz `random.shuffle(avail)` dentro do loop por aluno — O(n²) com cópias.

### 3.5 Processo / engenharia

1. Sem `requirements.txt`, sem `package.json`, sem lock de dependências.
2. Zero testes (unitários, integração, E2E).
3. Sem CI/CD, sem ambientes (dev/staging/prod) versionados.
4. Repositório é "dump" estático + um commit único (shallow).
5. Segredos versionados (zoho.js).

---

## 4. FUNCIONALIDADES "OCULTAS" (sem interface evidente, mas implementadas)

| ID | Funcionalidade | Evidência |
|---|---|---|
| OCULTA-001 | Licença legada `tricalc` libera TODOS os sistemas legados | `server.py:59` |
| OCULTA-002 | Modo de relaxamento de disponibilidade do HorIA (gera horário violando disponibilidade, minimizando violações) — **código latente: implementado em `resolver_modelo(relaxar_disponibilidade=...)`, mas nunca invocado pelo caller** | `server.py:774,781,801,1067,1091` |
| OCULTA-003 | Migração silenciosa de formatos antigos de dados do HorIA | `expandGrid`, remap de fixos |
| OCULTA-004 | Índice global `temp_links` (lookup do link de cadastro) | `horia/index.html:871` |
| OCULTA-005 | Quiosque RemanejIA escreve direto no projeto do dono (sem auth) | `remanejia/index.html:1109` |
| OCULTA-006 | Backup de config da escola em `escolas/{uid}/config` para os links funcionarem | `horia/index.html:967` |
| OCULTA-007 | `manual.py` gera manual HorIA v2.3.0 (weasyprint) | `manual.py` |
| OCULTA-008 | AdSense carregado no portal | `index.html:10` |

---

## 5. MAPA DE COBERTURA TNE (o que a especificação exige × o que existe)

| Sistema TNE | Existe hoje? | Estratégia |
|---|---|---|
| MapIA | ✅ completo + melhorias a fazer | **Preservar** motor; migrar UI; adicionar layouts tradicional/U/grupos 2–6/roda |
| HorIA | ✅ completo | **Preservar** CP-SAT; migrar UI; professor institucional visualiza horário |
| SomatorIA | ✅ completo | **Preservar** scanner+gabarito; migrar UI |
| RemanejIA | ✅ completo | **Preservar** algoritmo; adicionar % de mistura |
| AvalIA | ✅ completo | **Preservar**; migrar UI |
| ProvIA | ✅ completo | **Preservar**; migrar UI |
| Simulador TRI | ✅ completo | **Preservar**; migrar UI |
| BuscIA | ❌ novo | **Criar** (módulo + extensão Chrome WhatsApp Web) |
| DomicilIA | ❌ novo | **Criar** |
| Notas | ❌ novo | **Criar** |
| Presença | ❌ novo | **Criar** (C/F/A + tempo de atraso; integra BuscIA) |
| Gestão de Alunos | ❌ novo | **Criar** (cadastro central turmas→alunos, consumido pelos demais) |
| Boletim | ❌ novo | **Criar** (alimentado por Notas, formato personalizável) |
| Dashboard | ❌ novo | **Criar** (por perfil/instituição/plano, períodos) |
| Systematrix Studio | ❌ novo | **Criar** (automações visuais extensíveis) |
| Regras institucionais | ❌ novo (parcial: regras do HorIA são outra coisa) | **Criar** (limites por período, literal; detecção de conflito regra×permissão) |
| Permissões/cargos | 🟡 primitivo (`sistemasAcesso` por professor) | **Evoluir** para cargos personalizáveis + permissões granulares |
| Convites de usuário | ❌ novo | **Criar** (convite pendente → ativação no registro) |
| Multi-tenant | 🔴 não existe | **Criar** (isolamento por instituição + contexto explícito) |
| Planos FREE/ESSENCIAL/PROFISSIONAL/ESCOLA | 🟡 só `acquiredSystems` | **Criar** (bloqueio backend, limites por plano) |
| Assinaturas Mercado Pago | 🟡 checkout simples | **Criar** (recorrência, webhooks, upgrade/downgrade, tolerância 7d) |
| Painel admin global | ❌ novo | **Criar** (visão somente-leitura da instituição, confirmações, auditoria) |
| Integrações Google/Microsoft | ❌ novo | **Criar** |
| Recuperação de senha | ❌ | **Criar** |
| OAuth Google/Microsoft | ❌ | **Criar** |
| RedAI / Lumora / BiblIA / Cafezinho | legado (só site) | **NÃO implementar** (fora da TNE) |

---

## 6. DEPENDÊNCIAS EXISTENTES

**Backend (inferidas — não há requirements.txt):** `flask`, `flask-cors`, `ortools`, `firebase-admin` · `weasyprint` (manual.py)
**Frontend (CDN):** Firebase JS 8.10.1 (v9.15.0 no AvalIA), Font Awesome 6.4, Bootstrap 5 (HorIA), jsPDF 2.5.1 + autotable 3.5.29, Chart.js, html2canvas 1.4.1, SheetJS (RemanejIA), Google Fonts (Poppins/Inter), AdSense, Cloudflare Beacon.

---

## 7. INCOMPATIBILIDADES E RISCOS DE MIGRAÇÃO

1. **Contas legadas** com e-mails artificiais por produto (`usuario@m.systematrix.com.br`) — precisam de estratégia de migração para contas reais.
2. **Dados legados em 5 projetos Firebase antigos** — decisão de migração pendente.
3. **Modelo `escolas/{uid}` do HorIA** × novo modelo institucional — migração de `professores_pendentes`, `horarios_publicos`, `temp_links`.
4. **Workers externos (bepis/ppc) fora do repo** — precisam ser absorvidos pelo backend Python novo ou substituídos.
5. **Links públicos ativos** (quiosque RemanejIA, horários públicos, links de cadastro de professor) — não podem quebrar sem migração/redirect.
6. **IDs de licença legados** (`acquiredSystems` strings livres) × novos planos.
