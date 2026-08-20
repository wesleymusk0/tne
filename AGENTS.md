\# AGENTS.md — Systematrix



\## 1. Propósito



Este arquivo define as regras globais que devem ser seguidas por qualquer agente de desenvolvimento que trabalhe neste repositório.



A Systematrix é uma plataforma educacional composta por múltiplos sistemas, módulos e serviços integrados. O agente deve tratar o projeto como um sistema existente em produção, mesmo quando estiver trabalhando em ambiente de desenvolvimento.



O objetivo principal de qualquer alteração é:



1\. Implementar integralmente o requisito solicitado.

2\. Preservar todas as funcionalidades existentes.

3\. Evitar regressões.

4\. Respeitar a arquitetura existente.

5\. Manter compatibilidade entre frontend, backend, banco de dados e integrações.

6\. Testar efetivamente o resultado.

7\. Não considerar uma tarefa concluída apenas porque o código compila.



\---



\## 2. Regra fundamental



\### NÃO QUEBRAR FUNCIONALIDADES EXISTENTES.



Antes de modificar qualquer parte do sistema, o agente deve descobrir:



\* quem utiliza o código;

\* quais módulos dependem dele;

\* quais APIs dependem dele;

\* quais componentes do frontend dependem dele;

\* quais dados dependem dele;

\* quais testes cobrem o comportamento;

\* quais integrações externas dependem dele.



Nenhuma funcionalidade existente deve ser removida, desativada, simplificada ou substituída sem autorização explícita na tarefa.



Quando uma nova implementação substituir uma interface ou arquitetura existente, o comportamento funcional anterior deve ser preservado, salvo quando a especificação determinar explicitamente uma mudança de comportamento.



"Refatorar" não significa "remover funcionalidades".



"Modernizar" não significa "simplificar removendo recursos".



"Reescrever" não significa "recriar apenas o que parece importante".



\---



\## 3. Regra de preservação funcional



Quando uma tarefa solicitar uma nova interface, nova arquitetura ou nova implementação de determinado sistema, considere como requisito implícito:



> Tudo que existia anteriormente deve continuar existindo e funcionando, exceto aquilo que a especificação explicitamente determinar que deve ser removido ou alterado.



Ao substituir uma interface:



\* preserve todas as funcionalidades;

\* preserve regras de negócio;

\* preserve permissões;

\* preserve integrações;

\* preserve estados;

\* preserve validações;

\* preserve fluxos;

\* preserve tratamento de erros;

\* preserve dados;

\* preserve comportamentos importantes.



A nova interface deve ser considerada uma evolução do sistema existente, e não uma nova aplicação independente.



\---



\## 4. Antes de alterar o código



Para tarefas médias ou grandes, não comece imediatamente a editar arquivos.



Primeiro:



1\. Leia a estrutura do repositório.

2\. Identifique frontend, backend, banco, testes e serviços.

3\. Identifique os pontos de entrada da aplicação.

4\. Identifique os módulos envolvidos.

5\. Pesquise referências e dependências dos componentes afetados.

6\. Leia as implementações existentes relevantes.

7\. Leia os testes existentes relevantes.

8\. Identifique integrações externas.

9\. Identifique riscos de regressão.

10\. Elabore mentalmente ou explicitamente um plano de implementação.



Para tarefas de grande escala, produza um plano antes de executar mudanças significativas.



Se houver uma ambiguidade que possa causar uma decisão arquitetural incorreta, peça esclarecimento em vez de inventar um requisito.



\---



\## 5. Não assumir que o código existente está errado



O agente não deve substituir código simplesmente porque existe uma abordagem tecnicamente mais moderna.



Antes de alterar uma implementação existente, determine:



\* por que ela existe;

\* quem depende dela;

\* quais comportamentos ela fornece;

\* quais limitações possui;

\* se a mudança realmente é necessária.



Priorize evolução incremental quando isso reduzir risco.



Não faça refatorações não solicitadas apenas por preferência pessoal.



\---



\## 6. Arquitetura



Respeite a arquitetura existente do projeto.



Antes de introduzir:



\* nova biblioteca;

\* novo framework;

\* novo serviço;

\* nova API;

\* nova camada;

\* nova estratégia de autenticação;

\* novo banco;

\* nova estrutura de dados;

\* novo padrão arquitetural;



avalie se isso é realmente necessário para a tarefa.



Evite introduzir complexidade sem benefício concreto.



Não crie duplicação de lógica quando a funcionalidade existente puder ser reutilizada com segurança.



Não copie código existente apenas para evitar compreender sua arquitetura.



\---



\## 7. Dependências



Antes de adicionar uma dependência:



1\. Verifique se uma dependência existente já resolve o problema.

2\. Verifique compatibilidade com o projeto.

3\. Verifique impacto no build.

4\. Verifique impacto no ambiente de execução.

5\. Verifique se a dependência é realmente necessária.

6\. Evite dependências abandonadas ou desnecessárias.



Não altere versões de dependências sem necessidade.



Se uma atualização de dependência for necessária, execute os testes de regressão relacionados.



\---



\## 8. Banco de dados



Alterações de banco de dados exigem atenção especial.



Nunca altere estruturas de dados sem verificar:



\* código que lê os dados;

\* código que grava os dados;

\* consultas;

\* índices;

\* regras de segurança;

\* APIs;

\* migrações;

\* componentes do frontend;

\* scripts existentes;

\* testes.



Não apague dados existentes para facilitar uma implementação.



Não altere o formato de dados existente sem avaliar compatibilidade.



Quando uma alteração incompatível for inevitável, implemente uma estratégia de migração adequada.



\---



\## 9. APIs e contratos



Ao alterar uma API:



1\. Localize todos os consumidores.

2\. Verifique frontend e backend.

3\. Verifique integrações externas.

4\. Preserve compatibilidade sempre que possível.

5\. Atualize os consumidores afetados.

6\. Atualize ou crie testes.



Não altere silenciosamente:



\* nomes de campos;

\* tipos;

\* códigos HTTP;

\* formatos de resposta;

\* autenticação;

\* permissões;

\* parâmetros;



sem verificar o impacto.



\---



\## 10. Frontend



O frontend deve ser tratado como parte funcional do sistema, não apenas como apresentação visual.



Ao alterar uma interface:



\* preserve todas as funcionalidades;

\* preserve estados;

\* preserve permissões;

\* preserve validações;

\* preserve mensagens importantes;

\* preserve navegação;

\* preserve integrações;

\* preserve responsividade;

\* preserve acessibilidade quando existente.



Uma interface visualmente bonita que perde funcionalidades é considerada uma implementação incorreta.



Não considere uma tela concluída apenas porque ela renderiza sem erros.



\---



\## 11. Backend



No backend:



\* preserve regras de negócio;

\* preserve validações;

\* preserve autenticação;

\* preserve autorização;

\* preserve tratamento de erros;

\* preserve contratos de API;

\* preserve integrações;

\* evite duplicação de lógica.



Não mova regras de negócio para o frontend apenas para facilitar uma implementação.



Não confie em validações exclusivamente no cliente quando a regra precisar ser garantida pelo servidor.



\---



\## 12. Autenticação e autorização



Autenticação e autorização são áreas críticas.



Nunca:



\* remova verificações de permissão;

\* permita acesso apenas porque o frontend escondeu um botão;

\* exponha informações protegidas;

\* desative autenticação para facilitar testes;

\* coloque credenciais reais no código.



Qualquer alteração relacionada a usuários, permissões ou acesso deve ser testada explicitamente.



\---



\## 13. Segurança



Nunca introduza deliberadamente:



\* segredos no código;

\* senhas em arquivos versionados;

\* tokens expostos;

\* chaves privadas;

\* credenciais de produção;

\* endpoints desprotegidos;

\* bypasses de autenticação;

\* validações inseguras.



Utilize variáveis de ambiente ou mecanismos apropriados para informações sensíveis.



Não utilize dados reais de produção para testes quando dados artificiais forem suficientes.



\---



\## 14. Tratamento de erros



Não esconda erros apenas para fazer testes passarem.



Evite:



\* `try/catch` vazios;

\* ignorar exceções;

\* retornar sucesso quando houve falha;

\* remover logs úteis;

\* mascarar erros de API;

\* desabilitar validações.



O tratamento de erros deve tornar o sistema mais previsível e diagnosticável.



\---



\## 15. Testes



Testes são parte da implementação.



Sempre que possível, uma nova funcionalidade deve possuir testes apropriados.



Utilize o nível de teste adequado:



\* testes unitários para lógica isolada;

\* testes de integração para componentes integrados;

\* testes de API para contratos;

\* testes de banco para operações críticas;

\* testes E2E para fluxos completos;

\* testes pelo navegador quando a alteração afetar comportamento visual ou interação do usuário.



Não escreva testes apenas para aumentar cobertura.



Os testes devem verificar comportamento real.



\---



\## 16. Testes de regressão



Depois de uma alteração significativa, execute não apenas os testes da nova funcionalidade, mas também os testes das áreas afetadas.



Quanto maior a alteração, maior deve ser a abrangência da validação.



Uma alteração que modifica uma camada compartilhada deve receber testes das funcionalidades que dependem dessa camada.



\---



\## 17. Teste como usuário final



Quando a tarefa alterar uma aplicação web, não considere suficiente verificar apenas o código.



Quando as ferramentas disponíveis permitirem, execute a aplicação e valide os fluxos relevantes como um usuário real.



Verifique:



\* aplicação inicia;

\* páginas carregam;

\* navegação funciona;

\* autenticação funciona;

\* formulários funcionam;

\* botões funcionam;

\* dados aparecem;

\* dados podem ser alterados;

\* mensagens de erro funcionam;

\* APIs respondem corretamente;

\* não existem erros relevantes no console;

\* não existem erros inesperados de rede;

\* o fluxo completo produz o resultado esperado.



Se o navegador estiver disponível para o agente, utilize-o para validar os fluxos relevantes.



\---



\## 18. Build



Antes de concluir uma tarefa que modifica código executável:



1\. Execute o processo de build apropriado.

2\. Corrija erros.

3\. Execute novamente.

4\. Não considere a tarefa concluída enquanto o build necessário estiver quebrado.



Se o projeto possuir múltiplos builds, valide aqueles afetados pela alteração.



\---



\## 19. Type checking e lint



Quando o projeto possuir ferramentas de:



\* type checking;

\* lint;

\* formatação;

\* análise estática;



execute-as quando forem relevantes para a alteração.



Não desative regras de lint ou type checking simplesmente para eliminar erros.



Se uma regra precisar realmente ser alterada, justifique a necessidade e avalie o impacto.



\---



\## 20. Não alterar testes para esconder problemas



Nunca altere ou remova um teste existente simplesmente porque a implementação nova faz o teste falhar.



Quando um teste falhar:



1\. determine a causa;

2\. determine se o comportamento mudou intencionalmente;

3\. se não mudou intencionalmente, corrija a implementação;

4\. somente altere o teste quando o requisito realmente tiver mudado.



Testes existentes são evidências importantes do comportamento esperado do sistema.



\---



\## 21. Diagnóstico de falhas



Quando um teste falhar:



1\. leia o erro completo;

2\. identifique a causa raiz;

3\. não corrija apenas o sintoma;

4\. faça a menor alteração segura necessária;

5\. execute novamente o teste;

6\. execute os testes relacionados;

7\. verifique possíveis regressões.



Não marque uma tarefa como concluída enquanto houver falhas causadas pela própria alteração.



\---



\## 22. Ciclo obrigatório de desenvolvimento



Para alterações significativas, utilize o seguinte ciclo:



```text

ANALISAR

&#x20;   ↓

PLANEJAR

&#x20;   ↓

IMPLEMENTAR

&#x20;   ↓

EXECUTAR

&#x20;   ↓

TESTAR

&#x20;   ↓

ANALISAR FALHAS

&#x20;   ↓

CORRIGIR

&#x20;   ↓

TESTAR NOVAMENTE

&#x20;   ↓

VALIDAR REGRESSÕES

&#x20;   ↓

VALIDAR COMO USUÁRIO

&#x20;   ↓

REVISAR

&#x20;   ↓

CONCLUIR

```



O ciclo deve ser repetido quando necessário.



Não interrompa o processo simplesmente porque a primeira implementação parece funcionar.



\---



\## 23. Grandes alterações



Quando uma tarefa envolver muitas partes do sistema, divida mentalmente ou explicitamente o trabalho em etapas.



Exemplo:



```text

1\. Análise

2\. Backend

3\. Banco

4\. APIs

5\. Frontend

6\. Integrações

7\. Testes unitários

8\. Testes de integração

9\. Testes E2E

10\. Testes de regressão

11\. Auditoria final

```



Após cada etapa importante, valide o resultado antes de continuar quando isso reduzir risco.



Não implemente cegamente dezenas de mudanças independentes sem verificar o estado intermediário quando houver risco significativo.



\---



\## 24. Preservação durante reescritas de interface



Quando a tarefa solicitar:



> "Recriar", "replicar", "modernizar", "refazer" ou "migrar" uma interface existente



interprete isso como:



> Reproduzir a funcionalidade existente na nova implementação, preservando o comportamento do sistema, salvo especificação explícita em contrário.



Antes de considerar a nova interface concluída, compare:



\* funcionalidades;

\* páginas;

\* menus;

\* ações;

\* formulários;

\* filtros;

\* pesquisas;

\* tabelas;

\* permissões;

\* estados;

\* integrações;

\* mensagens;

\* fluxos de navegação.



Uma réplica visual que não reproduz as funcionalidades existentes não atende ao requisito.



\---



\## 25. Não remover funcionalidades silenciosamente



Se uma funcionalidade existente parecer obsoleta, inadequada ou desnecessária, não a remova por iniciativa própria.



Se a tarefa não autorizar sua remoção:



> preserve-a.



Se houver conflito entre uma nova especificação e uma funcionalidade existente, sinalize o conflito e siga a instrução explícita da tarefa quando ela determinar o comportamento.



\---



\## 26. Git



Mantenha as alterações organizadas.



Antes de modificar arquivos importantes, compreenda o estado atual do repositório.



Não descarte alterações existentes do usuário.



Não execute comandos destrutivos de Git sem necessidade explícita.



Evite:



\* `git reset --hard`;

\* remoções indiscriminadas;

\* sobrescrita de alterações não relacionadas;

\* reescrita desnecessária do histórico.



Não altere arquivos não relacionados à tarefa sem justificativa.



\---



\## 27. Escopo



Faça apenas as alterações necessárias para cumprir a tarefa.



Não aproveite uma tarefa para:



\* reescrever todo o projeto;

\* trocar frameworks;

\* reorganizar pastas sem necessidade;

\* substituir bibliotecas;

\* modificar funcionalidades não relacionadas;

\* alterar estilos globalmente;

\* fazer refatorações cosméticas extensas.



Se uma alteração adicional for indispensável para a tarefa, faça-a.



Se não for indispensável, deixe-a para outra tarefa.



\---



\## 28. Qualidade do código



O código produzido deve:



\* seguir os padrões existentes;

\* ser legível;

\* ser manutenível;

\* evitar duplicação;

\* possuir nomes claros;

\* possuir tratamento adequado de erros;

\* respeitar separação de responsabilidades;

\* evitar complexidade desnecessária.



Não otimize prematuramente.



Não introduza abstrações complexas apenas para parecer mais arquitetural.



\---



\## 29. Documentação



Quando uma alteração mudar significativamente:



\* arquitetura;

\* configuração;

\* API;

\* banco;

\* processo de execução;

\* instalação;

\* integração;



atualize a documentação correspondente quando necessário.



Não crie documentação extensa para mudanças triviais.



\---



\## 30. Não inventar funcionalidades



Não implemente comportamentos que não foram solicitados apenas porque parecem convenientes.



Quando um requisito estiver claramente definido, siga-o.



Quando estiver ambíguo e a decisão puder alterar comportamento do sistema, peça esclarecimento.



Quando uma decisão for pequena, reversível e não afetar o comportamento existente, escolha a alternativa mais consistente com o código existente.



\---



\## 31. Não declarar sucesso prematuramente



Nunca considere uma tarefa concluída apenas porque:



\* os arquivos foram modificados;

\* o código parece correto;

\* o build passou;

\* um teste isolado passou;

\* a página abriu;

\* o frontend renderizou.



Uma implementação só deve ser considerada concluída quando as validações relevantes forem realizadas.



\---



\## 32. Definition of Done



Uma tarefa é considerada concluída somente quando:



\* \[ ] O requisito solicitado foi implementado.

\* \[ ] Todos os arquivos relevantes foram revisados.

\* \[ ] As funcionalidades existentes foram preservadas.

\* \[ ] Não existem regressões conhecidas.

\* \[ ] O código compila quando aplicável.

\* \[ ] O type checking passa quando aplicável.

\* \[ ] O lint passa quando aplicável.

\* \[ ] Os testes existentes relevantes passam.

\* \[ ] Novos testes foram criados quando necessários.

\* \[ ] Testes de integração foram executados quando relevantes.

\* \[ ] Testes E2E foram executados quando relevantes.

\* \[ ] A aplicação foi executada quando aplicável.

\* \[ ] Os fluxos críticos foram verificados.

\* \[ ] O navegador foi utilizado quando necessário para validar comportamento de usuário.

\* \[ ] Não existem erros relevantes no console.

\* \[ ] Não existem erros relevantes de rede.

\* \[ ] As APIs afetadas foram verificadas.

\* \[ ] Alterações de banco foram verificadas.

\* \[ ] Autenticação e autorização afetadas foram verificadas.

\* \[ ] Não foram introduzidos segredos ou credenciais.

\* \[ ] Não foram removidas funcionalidades sem autorização.

\* \[ ] Alterações não relacionadas foram evitadas.

\* \[ ] A implementação corresponde à especificação original.



\---



\## 33. Regra final



Quando houver conflito entre velocidade e segurança da alteração:



> Priorize a correção e a preservação do sistema.



Quando houver conflito entre uma implementação simples e uma implementação que preserve corretamente o comportamento existente:



> Priorize a preservação do comportamento existente.



Quando houver dúvida sobre se uma funcionalidade existente pode ser removida:



> Não remova.



Quando houver dúvida sobre se uma alteração está realmente funcionando:



> Teste.



Quando um teste falhar:



> Investigue, corrija e execute novamente.



Quando uma alteração grande parecer concluída:



> Procure ativamente por regressões antes de considerá-la concluída.



O objetivo não é apenas produzir código.



O objetivo é produzir uma \*\*Systematrix funcional, íntegra, testada e compatível com o comportamento existente\*\*, enquanto evolui de acordo com os requisitos solicitados.




---

## Apêndice — Notas de auditoria TNE (2026-08-19)

Fatos verificados do repositório (memória para futuras sessões):

- Backend: Flask monolítico `server.py` (1243 linhas) em PythonAnywhere (`systematrix.pythonanywhere.com`). Rotas: `/mapia/gerar`, `/remanejia/gerar`, `/avalia/gerar`, `/somatoria/calcular`, `/tri/analise`, `/gerar_horario`, `/otimizar_janelas`, `/balancear_carga`, `/alocar_ha`, `/otimizar_dias`. `processar_requisicao_horario` é código morto.
- Backend NÃO verifica Firebase ID token (confia no `uid` do JSON) — falha crítica. 4 rotas de otimização do HorIA sem verificação de licença.
- Firebase projeto único atual: `systematrix-apps` (RTDB + Auth e-mail/senha). Legado: 5 projetos por produto (só em `index2.html`).
- Raízes RTDB: `usuarios_institucionais/{uid}`, `instituicoes/{id}/{personalizacao,acquiredSystems}`, `users/{uid}` (legado), `admins_por_instituicao`, `professores_por_instituicao`, `logs_atividades/{instId}`, `dados_{mapia,horia,somatoria,remanejia,tri}/{uid}`, `escolas/{uid}/{config,professores_pendentes}` (legado HorIA), `horarios_publicos/{schoolUid}/{profId}`, `temp_links`, `config/manutencao`.
- Workers externos fora do repo: `bepis.systematrix.com.br` (criar contas de professor), `ppc.systematrix.com.br` (checkout MP), `create-preference.cartoonlandiapr.workers.dev` (legado).
- `zoho.js` contém segredos Zoho hardcoded — rotação/remoção pendente de autorização.
- Bug conhecido: `horia/index.html` concatena `'/dados_horia' + schoolUid` sem barra.
- Sem requirements.txt, sem testes, sem CI. SDK Firebase v8 em tudo exceto AvalIA (v9).
- Documentos de governança da TNE: `AUDITORIA-TNE.md` (inventário com IDs = checklist de regressão) e `PLANO-TNE.md` (plano aguardando aprovação + perguntas de decisão).

