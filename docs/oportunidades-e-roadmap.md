# Oportunidades além do SimplesVet e roadmap do VetClinic

> Complementa o [estudo de engenharia reversa](simplesvet-engenharia-reversa.md). Pesquisa feita em 29/10/2026.
> Regra de produto: funcionalidades equivalentes às do SimplesVet, **com a nossa cara**: paleta verde-azulada e coral, tipografia Nunito, sidebar escura, modais e cards atuais. Tudo mobile-first, com isolamento por clínica (RLS) em cada tabela nova.

## 1. Lacunas encontradas (o que o SimplesVet não atende ou atende mal)

| # | Lacuna | Evidência | Como atendemos |
|---|---|---|---|
| 1 | **Prontuário em texto livre**: não há sinais vitais estruturados nem evolução em gráfico | Estudo do app: o atendimento é um modelo HTML | Sinais vitais estruturados (T, FC, FR, ECC 1–9, dor 0–10), destaque fora da referência por espécie, curva de peso. **Entregue.** |
| 2 | **Alertas clínicos** são marcações soltas do cliente | Tags laranja no cabeçalho, sem ciclo de vida | Alerta como evento do animal, fixo no topo até ser resolvido. **Entregue.** |
| 3 | **IA ausente**: não há transcrição de consulta, resumo do histórico nem rascunho de SOAP | Tendência de 2026: scribes por IA (Shepherd, Covetrus Pulse, Instinct + ScribbleVet) e resumos de prontuário (IDEXX) | Resumo clínico automático (**entregue, por regras**). Fase futura: rascunho de consulta por voz e resumo por IA, sempre revisado pelo veterinário. |
| 4 | **Telemedicina e teletriagem** inexistentes | IDEXX e relatórios de mercado: crescimento forte, inclusive monetização de retornos e mensagens | Fase futura: teleconsulta com link, registro na ficha e cobrança no PDV. |
| 5 | **Conciliação bancária** (não só de cartões) | Reclamação no Reclame Aqui (nov/2024) | Fase financeiro: importação de OFX e conciliação de extrato. |
| 6 | **Comunicação de duas vias** com o tutor: só disparo de mensagens | Reviews de concorrentes valorizam SMS/WhatsApp com resposta registrada no prontuário | Fase relacionamento: conversa registrada na ficha. |
| 7 | **Módulos básicos cobrados à parte** (portal do tutor, NPS, internação, mensagens) e upsell agressivo | Estudo do app (banner fixo, bot "VetLover", redirecionamento para o "Mapa do Sucesso") | Portal do tutor e NPS no plano base. |
| 8 | **Mobile ruim** no núcleo legado (agenda, mapa de execução) | Estudo do app: layouts desktop fixos | Todas as telas novas são responsivas (a ficha empilha "Adicionar" e o resumo no celular). |
| 9 | **Interface inconsistente** (3 gerações de UI) | Estudo do app | Um design system só (o nosso). |
| 10 | **Microchip entre clínicas** inexistente | Estudo do app | Já entregue (busca entre clínicas com opt-in). |
| 11 | **Agendamento online pelo tutor** | Serviços públicos e universidades migrando para agendamento pelo WhatsApp/online | Fase agenda: link público de agendamento com slots livres. |
| 12 | **Documentos com dados do paciente sem setup** | No SimplesVet é preciso cadastrar modelos com etiquetas | Modelos prontos (atestado de saúde, de vacinação, termo de autorização) preenchidos automaticamente, mais impressão de receita. **Entregue.** |

## 1.1 Maiores dores das clínicas (pesquisa de 29/10/2026)

Fóruns, reclamações públicas, reviews e pesquisas de mercado apontam, em ordem de recorrência:

| Dor | Evidência | Resposta no VetClinic |
|---|---|---|
| **Pressão financeira e inadimplência** | 73% dos profissionais citam pressão financeira como maior desafio (Covetrus/Provet ANZ 2025); artigos brasileiros apontam a inadimplência como um dos maiores desafios das clínicas | Conta corrente com saldo na lista de clientes, recebimento no caixa, lembrete de cobrança pelo WhatsApp, fluxo de caixa com alerta de saldo negativo, DRE |
| **Retenção de clientes** | Dois terços das clínicas têm dificuldade de reter clientes (Provet Cloud 2025) | Central de lembretes: inativos há 6 meses, vacinas, aniversários, NPS |
| **Falta de retorno ao tutor depois do atendimento** | Reclamações no Reclame Aqui sobre falta de acompanhamento e WhatsApp sem resposta | Lembrete de pós-consulta do dia anterior e conversa registrada nos dois sentidos |
| **Faltas e confirmações** | Fornecedores vendem automação de confirmação por WhatsApp | Confirmação de agendamento de amanhã em um clique, com marcação de confirmado |
| **Resistência a preço** | Pesquisas apontam preço como principal fator competitivo | Orçamento impresso com validade, aprovação que vira venda |
| **Excesso de cliques e busca fraca** | Reviews de Covetrus Pulse, Hippo Manager e DaySmart | Busca global (Ctrl+K) por tutor, pet, CPF, telefone e microchip |
| **Conciliação bancária** | Reclame Aqui sobre o SimplesVet (nov/2024) | Importação de OFX e conciliação com sugestão automática |
| **Burnout e documentação** | Estresse médio de 6,6/10 (Provet Cloud 2025); tendência de scribes por IA | Ditado por voz nos campos clínicos (pt-BR, no navegador) |

## 1.2 Usabilidade: onde o SimplesVet confunde e o que fizemos

| No SimplesVet | No VetClinic |
|---|---|
| Menu com 13 seções e mais de 60 itens, submenus profundos | 4 grupos (Atendimento, Pacientes, Comercial, Gestão), 15 telas; busca global (Ctrl+K); barra inferior no celular com Painel, Agenda, Animais, Vendas e Menu |
| Três gerações de interface (modais Bootstrap, drawers, telas v3) e diálogos nativos do navegador | Um só componente de modal (folha que sobe no celular, janela no desktop, abre e fecha com animação) e diálogos/avisos próprios no lugar de confirm/alert/prompt |
| Painel começa vazio e exige montar widgets | "Precisa de atenção" calculado sozinho (pedidos online, tarefas atrasadas, vacinas atrasadas, vendas em aberto, devedores, estoque, contas vencidas, caixa fechado) e "Primeiros passos" para clínica nova |
| Ações de status escondidas atrás de um cadeado ("Habilitar todas as ações") | Botão do próximo passo em destaque e as demais ações visíveis |
| Layouts de desktop no celular (agenda, mapa de execução) | Testado em 375 px, 768 px e 1366 px: sem rolagem horizontal nem texto cortado nas 15 telas; itens do PDV viram cartões no celular |
| Autosave cria registro só por escolher o tipo | Nada é gravado sem o usuário salvar |
| Configuração prévia trabalhosa | Categorias financeiras, contas e modelos de mensagem já vêm criados |

Animações curtas (150–300 ms) no menu lateral (hambúrguer que vira X, rótulos que somem suavemente, largura e margem animadas), nos modais, na troca de tela e nos avisos; quem ativa "reduzir movimento" no sistema operacional não as vê.

## 2. Roadmap por fases

Cada fase entrega algo utilizável e testado, com migração, RLS, testes de isolamento e tela.

| Fase | Módulo | Paridade com SimplesVet | Diferencial nosso | Status |
|---|---|---|---|---|
| 1 | **Ficha do animal** | Timeline única, filtros por tipo, adicionar registros, consulta, vacina, peso, patologia, exame, receita, documento, observação | Sinais vitais estruturados, curva de peso, alertas, resumo clínico, modelos automáticos, impressão | ✅ Entregue |
| 2 | **Agenda** | Status por fluxo (Agendado → Confirmado → Em espera → Em atendimento → Atendido; Cancelado, Atrasado), profissional (fila), duração, tipos de atendimento, slots livres, tempo médio de espera e de atendimento | "Iniciar atendimento" abre a ficha; bloqueio de conflito de horário no banco; painel "Atendimento de hoje". Agendamento online fica para a fase 9 | ✅ Entregue |
| 3 | **Vacinas com protocolos** | Protocolo (doses + intervalo), programação automática, encadeamento, status Programada/Aplicada/Vencida | Programação visível na ficha e na tela de vacinas (atrasadas, próximos 7 e 30 dias) | ✅ Entregue |
| 4 | **Produtos, serviços e PDV/caixa** | Venda em atendimento a partir da ficha e da agenda, orçamento, PDV com leitor de código de barras, pagamento dividido, parcelas, desconto com limite por papel, abertura, sangria, suprimento e fechamento com conferência | Orçamento que vira venda; cancelamento estorna caixa, conta e estoque | ✅ Entregue |
| 5 | **Conta corrente do cliente** | Venda a prazo, adiantamento, uso de crédito, saldo na lista de clientes e no PDV | Cobrança pelo WhatsApp com modelo | ✅ Entregue |
| 6 | **Estoque** | Entrada por XML da NF-e (lote e validade), estoque mínimo e sugestão de compra, validade, perdas e inventário | Conta a pagar gerada na importação | ✅ Entregue |
| 7 | **Financeiro** | Contas a pagar e receber, repetição mensal, fluxo de caixa, DRE gerencial; vendas entram sozinhas | Conciliação bancária por OFX com sugestão automática | ✅ Entregue |
| 8 | **Internação** | Boxes, classificação de risco, prescrição com intervalo, mapa de execução, alta, transferência e óbito (registrado na ficha) | Incluso no plano | ✅ Entregue |
| 9 | **Relacionamento** | Central de lembretes (confirmação, vacinas, pós-consulta, cobrança, aniversário, inativos), NPS por link, cartão do pet por link, agendamento online com horários livres | Conversa de duas vias registrada no cliente | ✅ Entregue |
| 10 | **IA e telemedicina** | — | Ditado por voz e teleconsulta com sala de vídeo (Jitsi) no agendamento entregues. Resumo do histórico por IA depende de chave de API | Parcial |

## 3. Fontes
- Estudo do SimplesVet: [simplesvet-engenharia-reversa.md](simplesvet-engenharia-reversa.md)
- Reclame Aqui (SimplesVet, conciliação bancária): https://www.reclameaqui.com.br/simples-vet/pura-enganacao_WHonj_y-TJgN-5kN/
- IDEXX, tendências 2026: https://software.idexx.com/resources/blog/7-digital-veterinary-technology-trends-shaping-practices-in-2026
- Shepherd, IA em software veterinário 2026: https://www.shepherd.vet/blog/ai-in-veterinary-software-feature-comparison-for-2026/
- Guia 2026 de software veterinário (consolidação, scribes): https://helpsquad.com/blog/veterinary-practice-management-software/
- Ferramentas de IA para clínicas 2026: https://resources.rework.com/tools/ai-tools/best-ai-tools-for-veterinary-clinics-2026
- Capterra, reviews de software veterinário: https://www.capterra.com/resources/veterinary-software-reviews/ · https://capterra.com/p/152986/RoboVet/reviews/
- Agendamento por WhatsApp/online (UFRGS, prefeitura de Itupeva, HVEP-DF): https://www.ufrgs.br/petendocrine/servicos-2/ · https://tribunadejundiai.com.br/cidades/itupeva/clinica-veterinaria-movel-itupeva-2/ · https://www.correiobraziliense.com.br/cidades-df/2021/07/4938046-agendamento-on-line-no-hospital-veterinario-do-df-comeca-na-segunda--19-7.html
- Provet Cloud, Veterinary Insights Report 2025: https://www.provet.cloud/blog/provet-cloud-2025-veterinary-insights-report-reveals-top-industry-trends-and-challenges
- Covetrus, tendências e desafios 2025: https://software.covetrus.com/apac/veterinary-insights/article/covetrus-community/vet-industry-trends/
- Inadimplência em clínicas veterinárias: https://www.saudebusiness.com/gestao-veterinaria/como-melhorar-a-gestao-de-inadimplencia-em-clinicas-veterinarias/
- Reclame Aqui, falta de retorno após atendimento: https://www.reclameaqui.com.br/hospital-veterinario-caes-e-gatos/falta-de-acompanhamento-e-retorno-do-veterinario-apos-consulta-de-emergencia_SKt1WrTuGWhB8jmW/
- Reclame Aqui, agendamento pelo WhatsApp: https://www.reclameaqui.com.br/hospital-veterinario-sao-pedro/dificuldade-extrema-e-editado-pelo-reclame-aqui-para-agendamento-de-consultas-e-exames-pelo-whatsapp_WzoXxBoO8h6TH7ME/
- Automação de confirmações por WhatsApp e LGPD: https://www.wati.io/geo-brazil-pt/roteiro-para-automatizar-confirmacoes-e-retornos-por-whatsapp
- Capterra, reviews (cliques, busca, suporte): https://capterra.com/p/130107/Covetrus-Pulse/reviews/?page=9 · https://www.capterra.com/p/134667/Hippo-Manager/reviews/?page=2 · https://www.capterra.com/p/133166/DaySmart-Vet/reviews/?page=5
