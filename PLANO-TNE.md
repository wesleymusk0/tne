# PLANO DE IMPLEMENTAÇÃO — TNE (Transformação da Nova Experiência)

> Documento para **APROVAÇÃO**. Nenhuma implementação será iniciada antes do ace.
> Referência obrigatória: `AUDITORIA-TNE.md` (checklist de regressão).

---

## 1. Diagnóstico (resumo da auditoria)

- Backend Flask monolítico com os 5 motores (MapIA, RemanejIA, AvalIA, SomatorIA, TRI) + motor CP-SAT do HorIA, validação de licença por `uid` **sem verificação de ID token**.
- Frontends estáticos isolados por módulo, sem hub, sem dashboard, logins separados.
- Firebase RTDB com dois modelos de conta (institucional + legado) e dados por usuário (sem tenant).
- Sem testes, sem CI, sem gestão de dependências, com segredos expostos (`zoho.js`).
- Funcionalidades fortes a preservar: scanner Warp-Hunter, CP-SAT com regras/diagnósticos, quiosque RemanejIA, horário público por link, co-branding, logs, modo manutenção.

## 2. Arquitetura proposta

```
┌────────────────────────────────────────────────────────────────┐
│ VERCEL — Next.js (App Router) + React + TypeScript             │
│  /(auth) login · /(app) dashboard · /sistemas/{11 sistemas}    │
│  /painel-gestor · /admin-global · /gestao-alunos · /studio     │
│  Design System Systematrix (branco, azul, menu lateral)        │
└──────────────▲─────────────────────────────────────────────────┘
               │ REST (fetch, Firebase ID token no header)
┌──────────────┴─────────────────────────────────────────────────┐
│ BACKEND Python (FastAPI) — migração do Flask                   │
│  /engines/*  → motores preservados 1:1 (mapia, remanejia,      │
│                avalia, somatoria, tri, horia + CP-SAT)         │
│  /core/*     → auth, tenants, permissões, regras, planos,      │
│                assinaturas (Mercado Pago), auditoria, convites │
│  /integrations/* → Google Workspace, Microsoft 365             │
└──────────────▲─────────────────────────────────────────────────┘
               │ firebase-admin
┌──────────────┴─────────────────────────────────────────────────┐
│ FIREBASE (projeto único)                                       │
│  Authentication (email/senha + Google + Microsoft)             │
│  Realtime Database (multi-tenant por instituição)              │
└────────────────────────────────────────────────────────────────┘
Extensão Chrome BuscIA (manifest v3) — WhatsApp Web, aba única.
```

**Decisões-chave propostas (aguardando ace):**
1. **FastAPI** no lugar do Flask — mesmo time Python, async nativo, OpenAPI automático, melhor para os ~40 endpoints novos. Os 6 motores de negócio serão portados **função por função, sem alteração de lógica** (mesma entrada/saída).
2. **Next.js App Router + TypeScript + Tailwind** — fundo branco, menu lateral, azul claro/moderado para item ativo, logo Systematrix. Componentização por sistema (isolamento visual exigido na seção 11 da spec).
3. **Firebase RTDB permanece** (spec seção 7). Novo layout multi-tenant com **migração assistida** dos dados atuais.
4. **firebase-admin com verificação de ID token obrigatória** em toda rota (corrige a falha crítica da auditoria).
5. Hospedagem do backend: PythonAnywhere hoje → proposta: **Render/Fly.io/Cloud Run** (decidir conforme item 14 de perguntas). Vercel só para frontend.

## 3. Estrutura de frontend (Next.js)

```
app/
  (public)/            ← landing (substitui index/professores/escolas)
  login/  recuperar-senha/  convite/[token]/
  (app)/
    layout.tsx         ← shell: menu lateral + branding instituição + Systematrix
    dashboard/         ← hub central por perfil/plano/instituição
    sistemas/
      mapia/  horia/  somatoria/  remanejia/  buscia/  domicilia/
      notas/  presenca/  avalia/  provia/  simulador-tri/
    gestao/
      alunos/  turmas/  usuarios/  cargos/  regras/  boletim/
    assinatura/        ← planos, pagamento, histórico
    studio/            ← automações visuais
  admin-global/        ← painel administrativo global (área separada)
components/  lib/  hooks/  styles/
```

- Cada sistema = rota isolada com layout próprio (seção 11 da spec), compartilhando apenas: shell, dados acadêmicos centrais, permissões.
- Migração das UIs **tela a tela conforme inventário** (cada ID da auditoria vira um caso de teste).

## 4. Estrutura de backend (FastAPI)

```
api/
  core/
    auth.py          ← verifica ID token, resolve perfil/vínculos
    tenants.py       ← contexto institucional explícito (header/claim)
    permissions.py   ← cargos + permissões granulares
    rules.py         ← regras institucionais (limites literais por período)
    plans.py         ← FREE/ESSENCIAL/PROFISSIONAL/ESCOLA + limites
    billing.py       ← Mercado Pago: assinatura, webhooks, tolerância
    audit.py         ← logs administrativos globais
    invites.py       ← convites pendentes → ativação
  engines/
    mapia_engine.py      ← port 1:1 de gerar_mapia (+ novos layouts)
    remanejia_engine.py  ← port 1:1 + percentual de mistura
    avalia_engine.py     ← port 1:1 (réguas + textos)
    somatoria_engine.py  ← port 1:1 (soma binária)
    tri_engine.py        ← port 1:1 (3PL + SAEB)
    horia_engine.py      ← port 1:1 (CP-SAT, regras, diagnósticos, otimizações)
  routes/  (uma por domínio, mesmas assinaturas de resposta)
tests/  (pytest: engines + core + multi-tenant + permissões + planos)
requirements.txt  (novo — não existe hoje)
```

## 5. Estratégia de migração

1. **Port dos engines sem mudança de comportamento**: para cada engine, criar *golden tests* (entrada atual → saída atual) ANTES de migrar; o port só é aceito com golden tests verdes.
2. **Compatibilidade de API**: manter as 10 rotas atuais funcionando (mesmo path/contrato) durante a transição — frontends antigos continuam operando até o cutover.
3. **Migração de dados RTDB** (script one-shot, com dry-run + backup):
   - `dados_*`, `horarios_publicos`, `temp_links`, `escolas/{uid}/*` → novo layout por instituição;
   - `usuarios_institucionais` + `users` (legado) → modelo unificado com `vinculos[]`.
4. **Contas legadas**: mapear `acquiredSystems` → plano equivalente (decisão pendente — ver perguntas).
5. **Cutover por sistema** (feature flag por módulo), com rollback = desligar a flag.

## 6. Estratégia de banco (RTDB multi-tenant)

```
tenants/{instituicaoId}/
  info/  personalizacao/  contrato/ (sistemas, período, status)
  cargos/  regras/  usuarios/{uid}/
  turmas/  alunos/  responsaveis/
  presenca/{ano}/{mes}/{dia}/  notas/{periodo}/  boletins/
  projetos/{mapia|horia|...}/{projetoId}/   ← entidade por sistema (spec seção 12)
  domicilia/  buscia/
users/{uid}/vinculos/{instituicaoId}        ← vínculo + cargo + sistemas
plans/{uid}/                                ← plano individual
billing/{uid}/                              ← assinatura, histórico, tolerância
invites/{token}/                            ← convites pendentes
public/{horarios_publicos|kiosk|temp_links} ← compatibilidade de links
global/instituicoes/  global/audit/  config/manutencao
```

- Regras de segurança RTDB por tenant (auth.customClaims com `instituicaoId` + cargo) — **novo**, hoje inexistente/inseguro.
- Dados acadêmicos centrais (alunos/turmas) únicos, consumidos por todos os sistemas (spec seção 11/22).

## 7. Estratégia de autenticação

- Firebase Auth: e-mail+senha, Google, Microsoft (OAuth) — novos providers.
- Recuperação de senha (`sendPasswordResetEmail`) — novo.
- Backend valida `Authorization: Bearer <ID token>` em 100% das rotas (fastapi dependency).
- Custom claims: `instituicaoId` ativo, cargo, sistemas.
- Convite: registro com e-mail convidado → vínculo automático → cargo aplicado.
- Migração de contas legadas (e-mails artificiais) — **decisão pendente**.

## 8. Estratégia multi-tenant

- Contexto institucional explícito: seletor de instituição para usuários multi-vínculo; claim/tenant header em toda requisição.
- Isolamento garantido no backend (todo query filtrada por tenant) + RTDB rules + testes de isolamento (instituição A × B).
- Admin global: visão somente-leitura com escopo reduzido (sem notas/dados sensíveis de alunos).

## 9. Estratégia de permissões

- Cargos padrão: administrador, gestor, professor, responsável (sem "aluno" — Lumora fora de escopo).
- Cargos personalizados por instituição com permissões granulares: sistemas visíveis, menus, abas, ações (criar/editar/excluir/visualizar/emitir/gerenciar).
- Herança cargo→usuário; enforcement no backend (nunca só no frontend).

## 10. Estratégia de regras (institucionais)

- Motor de regras com escopo: sistema × período (mês/trimestre/ano letivo) × limite — **interpretação literal** (spec seção 27).
- Unidades de contagem por projeto: Mapa, Turmação, Horário, Correção, Triagem, Prova, Simulação, Atividade Domiciliar.
- **Detecção de conflito regra × permissão antes de salvar** com modal de confirmação (spec seção 29).

## 11. Estratégia de testes

- `pytest` (backend): golden tests dos 6 engines; unitários core (auth, regras, planos, tolerância); multi-tenant; permissões.
- `Vitest/Testing Library` (frontend): componentes críticos.
- `Playwright` (E2E): todos os fluxos da spec seção 48, por perfil (admin global, admin institucional, gestor, professor, responsável, individual) + tentativas de acesso indevido (seção 49).
- Massa de dados fictícia representativa (seed script).
- Checklist de regressão = inventário da auditoria (cada ID → status na nova versão).

## 12. Estratégia de migração dos sistemas (ordem por risco)

1. Fundação: auth + tenants + planos + permissões + regras + auditoria.
2. Gestão de Alunos/Turmas (base dos demais) + Presença.
3. Engines existentes (MapIA → RemanejIA → SomatorIA → AvalIA → TRI → ProvIA → HorIA) com golden tests.
4. Notas + Boletim.
5. BuscIA (módulo + extensão Chrome) + integração com Presença.
6. DomicilIA (+ lembretes agendados).
7. Dashboard + indicadores.
8. Assinaturas Mercado Pago (+ webhooks, tolerância).
9. Painel admin global.
10. Integrações Google/Microsoft.
11. Systematrix Studio.
12. Cutover, redirect das landings, desligamento gradual do legado.

## 13. Riscos

| Risco | Mitigação |
|---|---|
| Regressão nos motores (IP: pesos/réguas/CP-SAT) | Golden tests + port literal + revisão linha a linha |
| Quebra de links públicos ativos (quiosque, horários, cadastro professor) | Rotas de compatibilidade + migração de dados |
| Migração de contas legadas com e-mail artificial | Estratégia a definir (pergunta aberta) |
| Workers externos fora do repo (bepis/ppc) | Absorver no backend novo; contratos documentados |
| Timeout do CP-SAT em escolas grandes | Fila async (job + polling) se necessário — **sem alterar o solver** |
| Webhooks Mercado Pago exigem URL pública | Ambiente staging com URL pública (Vercel + backend cloud) |
| LGPD (dados sensíveis de alunos: necessidades, saúde) | Criptografia de transporte, regras RTDB, minimização, consentimento pela instituição |
| Extensão Chrome (store review, WhatsApp Web instável) | Manifest V3, content script resiliente, fallback manual |

## 14. Dependências novas (propostas — registro + justificativa)

| Dependência | Justificativa |
|---|---|
| `fastapi`, `uvicorn`, `pydantic` | Backend novo (async, validação, OpenAPI) |
| `pytest`, `httpx` | Testes backend |
| Next.js, React, TypeScript, Tailwind CSS | Frontend TNE (spec seção 7) |
| Firebase JS v10/v11 (unificar v8/v9) | SDK único atual |
| `mercadopago` (SDK Python) | Assinaturas/webhooks |
| Playwright, Vitest | E2E e unitários frontend |
| `google-api-python-client`, `msal` | Integrações Google/Microsoft |

## 15. Alterações críticas

1. Verificação de ID token em todas as rotas (quebra clientes maliciosos atuais — desejado).
2. Novo layout RTDB (migração obrigatória antes do cutover).
3. Unificação de contas (fim do e-mail artificial por produto).
4. Substituição gradual dos workers externos.
5. **Remoção/rotação do segredo Zoho + higienização do histórico git** (ação imediata recomendada — ver perguntas).

## 16. Possíveis incompatibilidades

- Contas legadas sem e-mail real (recuperação de senha impossível sem migração assistida).
- `users/{uid}.acquiredSystems` (strings livres) × catálogo fixo de planos.
- Links de pagamento `mpago.li` antigos permanecem válidos fora do novo fluxo (decidir desativação).
- Firebase v9 do AvalIA × v8 dos demais — unificação pode mudar comportamento de sessão persistida.

## 17. Ordem de implementação (macro-fases)

| Fase | Conteúdo | Critério de saída |
|---|---|---|
| F0 | Segurança imediata: rotação Zoho, remoção do segredo, verificação de token | Build verde + segredo revogado |
| F1 | Fundação (auth, tenants, planos, permissões, regras, auditoria) + CI | Testes core ≥90% verdes |
| F2 | Gestão Alunos/Turmas + Presença + shell Next.js + dashboard base | Fluxo E2E instituição→turma→aluno |
| F3 | Port dos 6 engines + UIs (golden tests) | Regressão do inventário 100% |
| F4 | Notas + Boletim + BuscIA + DomicilIA | Fluxos novos E2E |
| F5 | Billing Mercado Pago + painel global + integrações + Studio | Testes de billing + permissões |
| F6 | Migração de dados, cutover, redirects, relatório final | Checklist auditoria completo |

## 18. Critérios de validação

- Todo ID do inventário com status [preservado/migrado/melhorado/substituído/novo] — **zero "quebrado"**.
- Golden tests dos engines com saídas idênticas às da versão atual.
- E2E por perfil + acessos indevidos bloqueados (backend).
- Build Next.js + backend verdes; zero erro relevante de console/rede.
- Teste de isolamento multi-tenant A×B aprovado.
- Regras executadas literalmente (casos "3 por trimestre" ≠ "1 por mês").

## 19. Estratégia de rollback

- Branch `main` legada preservada + tag `pre-tne` antes de qualquer mudança.
- Cutover por feature flag (frontend) e por rota (backend) — rollback = toggle.
- Backup RTDB (export JSON) antes de cada migração + scripts de restore testados.
- Deploys Vercel com preview por PR; produção só com aprovação explícita (spec seção 54).

## 20. Estimativa de complexidade por etapa

| Etapa | Complexidade | Observação |
|---|---|---|
| F0 Segurança | Baixa | Alto impacto |
| F1 Fundação | **Alta** | Base de tudo (multi-tenant + planos + regras) |
| F2 Alunos/Presença | Média | Modelo de dados central |
| F3 Engines | **Alta** (volume) / Baixa (risco técnico, com golden tests) | HorIA é o maior |
| F4 Novos módulos | Alta | BuscIA exige extensão Chrome nova |
| F5 Billing/Painel/Integrações | Alta | Webhooks + OAuth externos |
| F6 Cutover | Média | Depende das migrações |

---

# PERGUNTAS QUE EXIGEM DECISÃO (bloqueantes ou arquiteturais)

1. **Contas legadas** (`users/{uid}`, e-mails artificiais `usuario@m.systematrix.com.br`): qual a regra de migração? Opções: (a) mapear para plano FREE e exigir atualização de e-mail no 1º login; (b) migração assistida pelo suporte; (c) outra.
2. **Dados dos 5 projetos Firebase antigos** (map-ia, somatoria-2401, redaia0, escolarize-horarios, tricalc0): migrar para o projeto único ou considerar obsoletos?
3. **Workers externos** (`bepis.systematrix.com.br`, `ppc.systematrix.com.br`, `create-preference.cartoonlandiapr.workers.dev`): temos acesso ao código/contas? Posso absorvê-los no backend FastAPI?
4. **Mercado Pago**: qual conta/credenciais usar em staging? (nunca em repo — via env). Confirma ausência de assinatura anual individual e valores FREE/39,90/99,90?
5. **Limites exatos por plano**: a spec exemplifica (MapIA 20 alunos; ProvIA 4 questões no FREE). Quais os limites formais de cada sistema no FREE? ESSENCIAL = "sem limites equivalentes" — confirmar.
6. **Backend hosting**: manter PythonAnywhere ou migrar para Render/Fly/Cloud Run (necessário para filas/webhooks com confiabilidade)?
7. **Domínio do novo app**: proposta `app.systematrix.com.br` (Vercel). Landings atuais migram para o Next.js (`systematrix.com.br`)? `index2.html` (legado) sai do ar?
8. **Extensão Chrome do BuscIA**: não existe no repositório — confirmar que deve ser criada do zero (Manifest V3)? Há conta de publicação na Chrome Web Store?
9. **Troca de administrador principal** (spec seção 43): proponho fluxo via suporte com (a) verificação de identidade por pergunta/resposta-chave opcional + (b) confirmação por e-mail do admin anterior com janela de 48h + (c) ação final do admin global com confirmação e auditoria. Aprova esse desenho?
10. **Segredo Zoho exposto**: autoriza revogação/rotação imediata no Zoho e remoção do arquivo/histórico? (O arquivo parece ser um rascunho não utilizado pelo app.)
11. **Regras RTDB atuais**: preciso de acesso (somente leitura) ao console Firebase para auditar as security rules atuais antes de propor as novas. Possível?
12. **BiblIA / Cafezinho** (presentes na landing legada): fora da TNE junto com RedAI/Lumora — confirmar?
13. **E-mails transacionais** (convites, lembretes DomicilIA, cobrança): qual serviço (SendGrid/Resend/SES)? Há conta existente?
14. **Ambientes**: confirmar criação de `staging` (Vercel preview + backend staging + RTDB de homologação) separado de produção.
15. **Logo/identidade**: uso o `systematrix.jpg` atual como base da nova identidade (branco + azul claro/moderado), ou há novo brandbook?

---

# REGISTRO DE DECISÕES (aprovado em 2026-08-19)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Contas legadas | **Banco será ZERADO** — sem migração de dados/contas. Greenfield sobre `systematrix-apps`. |
| 2 | Projetos Firebase antigos | Nada a fazer — já migrado para `systematrix-apps`. |
| 3 | Workers externos | Não é necessário acessá-los — serão substituídos pelo backend novo. |
| 4 | Planos/valores | Confirmado: FREE R$0, ESSENCIAL R$39,90/mês, PROFISSIONAL R$99,90/mês, apenas mensal. ESCOLA negociado (manual). |
| 5 | Limites FREE formais | MapIA: 20 alunos/mapa · ProvIA: 4 questões/prova · AvalIA: 3 triagens · TRI: 3 simulações · BuscIA: 15 mensagens/semana · SomatorIA: 5 correções. ESSENCIAL+: sem esses limites. |
| 6 | Backend hosting | **PythonAnywhere** (mantido). |
| 7 | Domínio | Novo app em **systematrix.com.br** (o site antigo será substituído). |
| 8 | Extensão BuscIA | **Criar do zero** (Manifest V3); SEM Chrome Web Store (distribuição sideload/empacotada). |
| 9 | Troca de admin principal | Fluxo aprovado: suporte → verificação (pergunta-chave opcional) → e-mail de confirmação ao admin anterior (janela 48h) → ação do admin global com confirmação + auditoria. |
| 10 | Segredo Zoho | **Autorizado**: remover `zoho.js` do repo e rotacionar credenciais no Zoho (ação do dono no console Zoho). |
| 11 | Regras RTDB | **Criar regras novas direto** — as atuais expõem o banco e serão substituídas. |
| 12 | BiblIA/Cafezinho | Fora da TNE (junto com RedAI/Lumora). |
| 13 | E-mail transacional | **Resend**. |
| 14 | Ambientes | Criar **staging** separado (Vercel preview + RTDB homologação). |
| 15 | Identidade visual | Usar `systematrix.jpg` como base (fundo branco, azul claro/moderado no item selecionado). |

