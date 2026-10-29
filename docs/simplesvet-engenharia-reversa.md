# SimplesVet — Estudo de engenharia reversa

> Estudo feito em 29/10/2026 navegando no app (conta de experimentação + "Clínica Exemplo") e na documentação pública (site, central de ajuda, diretórios de software).
> O detalhamento tela a tela, com todos os campos e opções capturados, está em [simplesvet-notas-de-campo.md](simplesvet-notas-de-campo.md). Este documento é a síntese: o que o produto é, como está organizado, as regras de negócio e o que isso significa para o VetClinicManager.

---

## 1. O produto em uma página

| Item | O que se sabe |
|---|---|
| Empresa | SimplesVet Tecnologia, fundada em 2013. Adquirida pelo **Grupo Petlove em jul/2025**, no mesmo ecossistema de Vetsmart, Vetus e DogHero. |
| Base | "Mais de 8.200/8.700 empresas" (site e tela de cadastro) |
| Público | Clínicas, consultórios, hospitais veterinários, pet shops e banho e tosa |
| Proposta | "Simples de usar", sistema completo num lugar só, suporte humano ("respondemos em até 5 minutos"), implantação e migração gratuitas (30+ conversores de outros sistemas) |
| Modelo comercial | SaaS mensal pré-pago, sem fidelidade e sem taxa de adesão; trial de 7 dias sem cartão |

### Planos e preços (simples.vet/precos, out/2026)

| Plano | Preço/mês | Usuários |
|---|---|---|
| Pet shop Básico | R$ 157 | até 3 (até 80 notas/mês) |
| Pet shop Avançado | R$ 220 | até 5 (NFC-e/NFS-e ilimitadas, comissões, DRE, etiquetas) |
| Clínica e Hospital | R$ 359 (3) · 389 (5) · 440 (10) · 549 (15) · 879 (25) · 979 (ilimitado) | pacotes |

**Adicionais:** Módulo Fiscal R$ 153 · Internação R$ 136 · WhatsApp R$ 0,50/msg · SMS R$ 0,25/msg · E-mail R$ 0,15/msg.
**Regras comerciais:** usuários **sem login** (banhista, tosador) não contam no pacote e servem só para agenda e comissão; fidelidade mínima de 3 meses só quando há migração de dados; indicação dá R$ 300 de desconto para quem indica e 50% na 2ª mensalidade para quem é indicado; gratuito para universidades.

### Diferenciais declarados × observados
- **Prontuário "amado por veterinários"**: timeline única do animal com 11 tipos de evento, modelos com variáveis e autosave. Confirmado; é o ponto mais forte do produto.
- **PDV integrado ao consultório**: o que é lançado na ficha, na agenda ou na internação vira "venda em atendimento" e cai no caixa. Confirmado.
- **Conta corrente do cliente** (crédito/débito/adiantamento), visível em todo lugar. Confirmado.
- **Estoque inteligente** (Repor/Excesso/Parado/Novo, sugestão de compra, mínimo/máximo calculados). Confirmado.
- **Integração financeira automática** (venda → lançamento → depósito da adquirente; comissão → contas a pagar). Confirmado.
- **Relacionamento**: mensagens automáticas, NPS, portal/app do tutor (SimplesPet), site grátis, campanha SMS. Existem, mas cada um é módulo ativado à parte.
- **Fiscal** (NFC-e, NFS-e, NF-e e devolução), integração Stone, plano de saúde Petlove, receita com certificado digital e portal de dispensação.

---

## 2. Arquitetura observada

- **Três gerações de front-end convivendo**:
  - **Legado PHP + Bootstrap 2/jQuery**, com rotas `*.php` (`/principal/cliente/cliente.php`, `/agenda/index.php`). Concentra a maior parte do núcleo: prontuário, PDV, agenda, internação e financeiro.
  - **/v2/** em Vue: comissões e inteligência.
  - **/v3/** em Vue SPA, com chunks em `static.simples.vet`: clientes, produtos, contas a pagar, cadastros novos e mensagens.
  - Resultado: visual e padrões de interação inconsistentes entre telas. Há modais Bootstrap, drawers ("svslider") e drawers v3, tudo no mesmo app.
- **Multi-tenant com troca de ambiente**: o mesmo login alterna entre a própria clínica e a "Clínica Exemplo" (botão `trocarAmbienteExperimentacao`). O cabeçalho muda de cor no ambiente demo.
- **Feature flags por assinatura**: a assinatura tem serviços (`PORTAL`, `INTERNACAO`, `NPS`, `SITE`, `COMISSAO`, `NFCE`, `INTELIGENCIA`), cada um com status, preço e dias de experimentação. Módulo inativo redireciona para o "Mapa do Sucesso", que funciona como upsell.
- **Permissões**: perfis com árvore de menus e ações granulares (seção 5.10). Sem permissão, a página `/errors/perm.php?url=...` exibe "Permissão negada".
- **Convenção do banco legado** (vista nos `name` dos campos): `<tabela 3 letras>_<tipo>_<nome>`, por exemplo `ani_var_nome`, `ani_cha_sexo`, `anp_dec_peso`, `pre_cha_via`, `int_cha_status`. Tipos: `var`, `int`, `dec`, `cha` (enum de 1–3 chars), `dat`, `dtf`, `txt`.
- **Terceiros**: Intercom (chat e bot "VetLover Virtual" de upsell), GTM/GA, Facebook Pixel, Unbounce, Sucuri (WAF), S3 `sa-east-1` para fotos, TinyMCE e CKEditor nos modelos.
- **Auditoria**: botão "Log" em quase todo registro, mais a tela Consultas > Log.

---

## 3. Mapa de navegação (menu lateral)

```
Conheça o SimplesVet (onboarding do trial)
Painel de controle
Atendimento clínico            → lista de tutores/animais → FICHA DO ANIMAL (prontuário)
Clientes                        (v3, drawer)
Agenda        › Agenda · Escala · Configuração
Vendas        › Ponto de venda · Minhas vendas · Movimentos de caixa · Consulta vendas · Pacotes vendidos ·
                Recebimentos · Lista de preços · Ranking de clientes · Saldo dos clientes · Formas de recebimento ·
                Modelo de orçamento · Modelo de demonstrativo · Configuração
Comissionamento › Comissões em aberto · Extratos
Inteligência  › Produtividade · Vendas
Consultas     › Vacinação · Aniversários · Log
Cadastros     › Espécies · Raças · Pelagens · Patologias · Tipos de atendimento · Vacinas · Exames ·
                Atributos de exames · Referências de exames · Modelo de receita · Origem dos clientes · Modelo de documento
Internação    › Animais internados · Mapa de Execução · Histórico · Parâmetros clínicos · Modelos de prescrição · Boxes
Estoque e serviços › Produtos e Serviços · Compras · Outras saídas · Análise de estoque · Inventário ·
                     Pedido de compra · Grupos · Marcas · Produtos recomendados
Financeiro    › Lançamentos · Conciliação de cartões · Contas a pagar · Demonstrativo · Fluxo de caixa ·
                Contas e cartões · Categorias · Fornecedores · Formas de pagamento
Beta          › Animais · Atendimentos
Configuração  › Empresa · Usuários · Acesso externo · Perfil de Acesso
Fiscal        › Notas de serviço · Notas de produto · Perfis Tributários
Site · Portal SimplesPet · Mensagens · Pesquisa de satisfação · Mapa do Sucesso · Treinamentos · Indique
```
As URLs de cada item estão nas notas de campo.

---

## 4. Fluxos centrais (ponta a ponta)

### 4.1 Consulta
1. **Agenda**: o agendamento usa tipo de atendimento, profissional (fila) e horário. **Só aparecem slots livres**, calculados pela escala em passos de 20 min.
2. **Check-in**: o status avança pelo botão principal do drawer (Agendado → Confirmado → Em espera → Em atendimento → Atendido). Cada transição pode exigir **campos personalizados** do tipo de atendimento.
3. **Ficha**: "Iniciar" abre a ficha do animal. O veterinário cria o evento *Atendimento*, e o **modelo do tipo** é carregado com variáveis já preenchidas. Ele registra peso, exame, receita e documento como eventos na timeline.
4. **Venda em atendimento**: produtos e serviços adicionados na ficha (painel esquerdo) ou na agenda ("+") formam uma venda com status *em atendimento*. Ao finalizar, ela fica *Aberta*.
5. **Caixa**: a recepção abre a venda no PDV, aplica desconto (dentro do limite), registra o recebimento com uma ou várias formas e parcelas, usando o crédito do cliente se houver. A venda passa a *Baixada*.
6. **Financeiro automático**: a baixa gera o lançamento na conta da forma de recebimento, o "Depósito" previsto da adquirente para o banco (com taxa) e a comissão do funcionário do item.
7. **Pós-venda**: as vacinas programadas geram lembrete automático, o retorno é agendado pela ficha, o NPS é enviado e o ciclo de vida do cliente é recalculado.

### 4.2 Internação
Triagem (risco, box, queixa) → **Admissão** → **Prescrições** (procedimento, medicamento ou fluidoterapia; recorrente, uma vez ou "quando necessário") → tarefas no **Mapa de Execução** (grade animal × hora; vermelho = atrasada) → execução, parâmetros clínicos, ocorrências e peso → relatório médico e comunicados ao tutor → **Alta** (interrompe os procedimentos pendentes), **Óbito** (com confirmação explícita; bloqueia novas prescrições) ou **Cancelamento** (reabrível). Os itens consumidos entram na venda em atendimento.

### 4.3 Estoque
Compra manual ou por **importação de XML da NF-e** (pode imprimir etiquetas na hora) → estoque e custo atualizados → saída por venda, consumo interno, avaria, perda de validade ou doação → **Análise de estoque** (com parâmetros de compra) classifica e sugere compra → **Pedido de compra** → inventário pelo celular.

---

## 5. Regras de negócio consolidadas

### 5.1 Cliente e animal
- O cliente pode ser **PF ou PJ**. Na PJ: CNPJ, regime tributário (Normal/Simples) e tipo de IE (Contribuinte, Não contribuinte, Isento), o que é necessário para nota fiscal.
- Código sequencial por empresa ("ficha") para cliente e animal, usado em toda busca: "nome ou ficha".
- **Marcações** (tags livres) no cliente e no animal aparecem em destaque laranja no cabeçalho da ficha, como alertas ("alérgico a shampoo de camomila").
- **Privacidade/LGPD**: o cliente escolhe os canais aceitos (E-mail, Campanha SMS, SMS, WhatsApp). Há tela de "E-mails inválidos" e opt-out de SMS.
- O animal tem: sexo (M/F/Indeterminado), esterilização (Castrado/Fértil, habilitada após o sexo), nascimento, espécie → raça (filtrada) → pelagem, microchip, pedigree e número, foto e status **Vivo/Óbito**.
- Parâmetro da empresa: idade do cliente como "somente aniversário" ou "data de nascimento".
- **Arquivamento automático** do cliente após 5 anos sem comprar (opcional). Ficha arquivada pode ser restaurada.
- **Ciclo de vida** (calculado pela data do último retorno ou compra):
  - **Ativos**: < 1 mês, 1–3 meses, 3–6 meses, 6–12 meses.
  - **Necessitam de atenção**: 1–2 anos, 2–3 anos.
  - **Abandonaram**: 3–5 anos, > 5 anos.
  - **Arquivados**.
- **Classificação ABC** de clientes por faturamento (permissão própria). Há também **Ranking de clientes**.
- **Origem do cliente** ("Como nos conheceu?"): cadastro próprio, usado como filtro e indicador.

### 5.2 Prontuário (ficha do animal)
- Uma **timeline única** com 11 tipos de evento: Atendimento, Peso, Patologia, Documento, Exame, Fotos, Vacina, Receita, Observações, Vídeo e Internação. Cada evento guarda autor (avatar), data e hora, filtros por tipo e por período, e impressão do histórico em PDF.
- **Atendimento = tipo + modelo**: ao escolher o tipo, o texto-modelo é carregado com **etiquetas mescladas** (`@ANIMAL_*`, `@RESPONSAVEL_*`, `@CLINICA_*`, `@USUARIO_*`, `@GERAL_*`, `@MENSAGEM_*`; lista completa nas notas). O **registro é criado imediatamente** e o **autosave a cada 20 s** vem ligado por padrão.
- Retorno agendado de dentro do atendimento. Anexos múltiplos. Impressão em A4 ou A5 com cabeçalho e margem configuráveis.
- **Bloqueio de eventos clínicos**: o evento fica imutável após X tempo da inclusão (de "não bloquear" a 30 dias). Configurável por empresa.
- Data retroativa exige permissão ("Alterar data e hora do evento").
- Exames: cadastro com **atributos** e **valores de referência** (por espécie). Pode anexar resultado e notificar o tutor por mensagem automática.
- Receitas: modelos próprios (compartilhados ou não), receituário de controle especial com **numeração sequencial** por veterinário, CRMV e MAPA no usuário, assinatura digitalizada ou **certificado digital (ICP)**, portal de dispensação.
- Documentos-padrão adequados à Resolução CFMV 1321: atestados (saúde, vacinação, óbito), guia de trânsito, termos de autorização e TCLE, solicitação de exame.

### 5.3 Vacinas
- O cadastro tem **grupo**: Vacinas, Vermífugos ou Antiparasitário. Mais laboratórios e status.
- **Protocolo** por vacina, com nº de doses e intervalo. Ao aplicar o protocolo na ficha (data inicial), **todas as doses são programadas**.
  - Doses fixas: depois da última dose o protocolo fica "Finalizado".
  - Doses indeterminadas (ex.: anual): cada aplicação gera a próxima programação.
  - **Encadeamento**: ao finalizar, o protocolo seguinte é programado automaticamente (ex.: filhote → adulto).
  - O protocolo pode ser **interrompido e retomado**. Inativar uma vacina não apaga o histórico. Há "fundir vacinas" para eliminar duplicadas.
- Status da dose: **Programada → Aplicada | Vencida**. A tela Consultas > Vacinação lista por período (padrão: próximos 7 dias) e alimenta o lembrete automático.
- Para cobrar e baixar estoque, o imunizante precisa também estar cadastrado como produto.

### 5.4 Agenda
- **Filas** = profissionais com agenda. Há usuários sem login só para agenda e comissão.
- **Escala** mensal por profissional e dia, com confirmação diária e "Confirmar o mês inteiro". Admite escalas extras e variáveis e bloqueios pontuais ou recorrentes (empresa ou profissional).
- Horário de funcionamento da empresa e horário de atendimento por usuário.
- **Fluxo de status pelo tipo de atendimento**:
  - Clínico: Agendado → Confirmado → Em espera → Em atendimento → Atendido. Laterais: Atrasado, Cancelado.
  - Banho e tosa: … → Em atendimento → **Animal pronto** → Atendido (na saída).
  - Simplificado: Agendado → Em espera → Em atendimento → Atendido.
  - O botão principal mostra **só o próximo passo**. O cadeado "Habilitar todas as ações" libera as demais transições.
- **Campos personalizados por transição de status** (texto, seleção, número, sim/não, hora; obrigatório ou opcional). É assim que se faz o checklist de entrada do banho e tosa.
- **Recorrência** de agendamento (frequência recomendada no tipo: semanal até anual). A exclusão pode ser só deste ou de todos os agendamentos.
- Tempo médio de espera (em espera → em atendimento) e de atendimento (em atendimento → atendido) vão para o painel.
- Drag-and-drop para remarcar. Comunicados na agenda. Impressão completa ou resumida.

### 5.5 Vendas e PDV
- **Tipos**: Venda ou Orçamento. **Tipo de venda** (fiscal): presencial consumidor final ou revenda, delivery/domiciliar, pedido por internet ou telefone.
- **Status**: Em atendimento → Aberto → Baixada parcial → Baixada. Orçamento tem validade e pode virar venda (e vice-versa, com permissão).
- Venda **sem cliente e sem pet** é permitida. Itens agrupados **por animal**. Cada item leva o **funcionário** (comissionado); pode ser obrigatório.
- **Desconto**: em R$ ou %, **rateado entre os itens**. Limite com hierarquia **produto → empresa → usuário**. Sem limite configurado, ninguém dá desconto, exceto usuários com limite próprio.
- **Recebimento**: várias formas na mesma venda, parcelas, NSU (pode ser obrigatório), uso de crédito do cliente, troco e data travada em hoje (retroativa só com permissão). **Baixa parcial** gera débito no cliente. **Baixa múltipla** quita várias vendas abertas do cliente de uma vez.
- **Unificar vendas do dia por cliente** (PDV + consultório) é uma opção.
- **Devolução**: devolve o valor como crédito ou em dinheiro (exige integração financeira), ou devolução direta ao consumidor. Afeta a comissão.
- **Caixa**: abertura com suprimento (conta de origem) → vendas, sangria, suprimento, despesa, transferência entre caixas → fechamento → **Encerrado / Em revisão** (gestor). Cada usuário tem a sua conta "Caixa - fulano". Opção **fechar todos os caixas às 23:59**.
- **Pacotes e kits**: pacote é um produto com N usos e validade em dias (ex.: "Banho e tosa higiênica – 365 dias"), consumido por animal, com histórico de uso e economia exibida. Kit é um conjunto de itens.
- **Lista de preços** (flag por item) e **produtos recomendados** (sugestão na venda).

### 5.6 Conta corrente do cliente
- **Saldo = créditos − débitos**, por responsável. Só os animais dele usam o crédito.
- **Débito** vem de venda aberta ou baixada parcialmente. **Crédito** vem de adiantamento no PDV ou de devolução como crédito.
- O crédito quita débito antigo ou paga nova venda e pode ser devolvido em dinheiro. O badge "Saldo devedor R$ X" aparece no cabeçalho da ficha, no drawer do cliente e na agenda.

### 5.7 Produtos e estoque
- **Tipo**: Produto, Serviço, Pacote ou Kit. **Propósito**: venda, consumo interno ou ambos. **Áreas**: Clínica, Petshop, Banho e Tosa (onde o item aparece).
- **Preço**: custo × markup desejado = preço sugerido. O sistema mostra o **markup real** e a opção "permite alterar preço na venda".
- **Fiscal**: NCM, EX TIPI, CEST, NVE + perfil tributário.
- Validade opcional por produto (alerta "N com validade vencida"). Unidade de venda, código de barras, marca, grupo e subgrupo, fracionamento e venda a granel.
- **Análise de estoque** (parâmetros: frequência de compra, tempo para elaborar o pedido, tempo de entrega, com override por fornecedor):
  - Média mensal de saída (últimos meses).
  - Duração estimada = estoque ÷ consumo diário.
  - Mínimo e máximo **calculados automaticamente**, sem edição manual depois de configurado.
  - Sugestão de compra.
  - Situação: **Repor** (abaixo do mínimo), **Excesso** (acima do máximo), **Parado** (sem saída), **Novo** (sem histórico).
- Estoque pode ficar negativo se a configuração "permite vender sem estoque" estiver ativa.

### 5.8 Financeiro
- **Contas** por tipo: Caixa, Conta corrente, Poupança, Cartão de crédito, Espécie, Investimento e **Recebimentos** (uma por forma de cartão). Há ainda a conta virtual "Vendas em aberto".
- **Lançamento**:
  - Campos: categoria (plano de contas), conta, descrição, documento, fornecedor, forma, **competência**, natureza (receita ou despesa), vencimento, valor (juros, multa e desconto), pago em, recorrência (semanal, mensal, anual ou parcelado) e "pagar automaticamente no vencimento".
  - A transferência entre contas é um lançamento à parte.
- **DRE** em regime de **caixa ou competência**, com plano de contas padrão: Receita (Vendas, Vendas em aberto, Adiantamento de clientes, Descontos financeiros) − Despesas com mercadorias − Deduções (taxa de cartão, Pix, antecipação) − Impostos (Simples) − Despesas operacionais (administrativas, pessoal…).
- **Conciliação de cartões**: confronta previsão e recebido (antecipação, prazos, arredondamento), usando o NSU.
- Fluxo de caixa, contas a pagar com cards (Não pagos, Pagos, Vencidos, A vencer) e lembrete de contas a pagar por mensagem.

### 5.9 Comissões
- Configuração global:
  - **Base líquida ou bruta**.
  - Gera comissão **só sobre vendas baixadas** (ou lançadas).
  - **Abate a taxa da operadora**.
  - **Transparência**: o funcionário vê as próprias comissões.
- Por usuário: "recebe comissão" e data de corte. Por item: % de comissão.
- **Fechamento de extrato** por funcionário gera **conta a pagar** automática. Permite adiar itens, trocar o comissionado, reabrir e imprimir recibo.

### 5.10 Usuários e permissões
- Um login por pessoa. Usuários **sem login** não consomem licença. Arquivar e restaurar usuário.
- Perfis-modelo: **Administrador, Gestor da Clínica, Veterinário, Recepcionista, Esteticista**. Para personalizar, duplica-se um modelo e edita.
- Permissão por **menu + ação granular** (ex.: "Venda > Conceder desconto", "Caixa > Reabrir", "Internação > Registro de óbito") e por **widget e indicador do painel**. A lista completa está nas notas.
- **Acesso externo**: Liberado ou Controlado (bloqueia acesso fora da rede da clínica).
- O usuário guarda CRMV, MAPA, numeração sequencial de receituário, assinatura, pronome de tratamento e foto.

### 5.11 Relacionamento
- **Mensagens automáticas**:
  - Para clientes: boas-vindas (cliente ou animal), lembrete de agendamento, lembrete de vacina/vermífugo, aniversário (cliente ou animal), resultado de exames.
  - Para a equipe: agenda diária, contas a pagar.
  - Canais: SMS, e-mail e WhatsApp (templates aprovados). Créditos pré-pagos e histórico de mensagens.
- **Campanha SMS** segmentada, com envio programado e opt-out. O público pode ser criado a partir da Inteligência.
- **NPS** (configuração, respostas e painel), última resposta exibida na ficha. **Portal/App SimplesPet** para o tutor, com convite pelo cadastro. **Site Expresso** (slideshow, destaques, páginas, mensagens).

### 5.12 Painel e Inteligência
- Painel configurável: widgets arrastáveis e indicadores (lista nas notas). Gráficos agregados a cada 24 h.
- Inteligência de vendas:
  - Evolução de líquido, bruto, ticket, descontos e quantidades.
  - Vendas por data, produtos e serviços mais vendidos, grupos, marcas, dia da semana, turno, pacotes, kits e tipo de item.
  - Abas Vendas, Clientes e Animais.
- Produtividade por funcionário e "Minhas vendas".

---

## 6. Modelo de dados inferido (entidades principais)

```
Empresa(tenant) 1─* Usuario ─* PerfilAcesso(permissões)
Empresa ─ Assinatura ─* ServicoAssinado(PORTAL|INTERNACAO|NPS|SITE|COMISSAO|NFCE|INTELIGENCIA)
Cliente(PF/PJ, código, marcações, canais, origem) 1─* Animal(código, espécie, raça, pelagem, sexo, castrado, nascimento, microchip, óbito)
Animal 1─* Evento(tipo ∈ {atendimento, peso, patologia, documento, exame, foto, vacina, receita, observação, vídeo, internação}, autor, data, bloqueado_em)
TipoAtendimento(duração, fluxo, frequência, modelo, campos_personalizados[status]) 1─* Agendamento(fila, início, fim, status, recorrência, valores_campos)
Usuario(fila) 1─* Escala(data, intervalos[], confirmada)
Vacina(grupo) 1─* Protocolo(doses, intervalo, encadeia→Protocolo) ; Animal 1─* AnimalProtocolo 1─* Dose(programada, aplicada, status)
Exame 1─* Atributo 1─* Referencia ; Modelo(documento|receita|orçamento|demonstrativo)
Internacao(animal, box, risco, status, veterinário, admissão, alta_prevista) 1─* Prescricao(tipo, frequência, intervalo, duração, dose, via…) 1─* Programacao(horário, status, realizado_em)
Internacao 1─* EventoInternacao(triagem, admissão, ocorrência, peso, parâmetros, relatório, comunicado, remanejamento, alta, óbito)
Produto(tipo ∈ {produto, serviço, pacote, kit}, propósito, áreas, custo, markup, preço, estoque, mínimo, validade, fiscal)
Venda(tipo, tipo_venda, status, cliente?, data) 1─* ItemVenda(animal?, produto, qtd, valor, funcionário, desconto_rateado)
Venda 1─* Recebimento(caixa, forma, valor, parcelas, NSU) ; Caixa(usuário, status) 1─* MovimentoCaixa
ContaFinanceira(tipo) 1─* Lancamento(categoria, natureza, competência, vencimento, pago_em, recorrência, origem: venda|comissão|compra)
Cliente 1─* Credito/Adiantamento ; Comissao(item, funcionário, base) *─1 ExtratoComissao → Lancamento(a pagar)
Compra(fornecedor, XML) 1─* ItemCompra ; SaidaEstoque(motivo) ; Inventario ; PedidoCompra
Mensagem(tipo, canal, status, custo) ; CampanhaSMS ; RespostaNPS
```

---

## 7. Pontos fracos e oportunidades para nós

1. **Inconsistência visual e técnica**: três gerações de UI, com modais, drawers e telas cheias convivendo. Um produto com **um único design system** já se diferencia.
2. **Agressividade de upsell**: banner fixo de promoção, bot de vendas e módulos básicos (NPS, portal, internação, fiscal, mensagens) cobrados à parte. Dá para oferecer mais coisa no plano base.
3. **Mobile**: o núcleo legado é desktop. A mesma tela com 4 colunas fixas (agenda, mapa de execução) funciona mal no celular. *Mobile-first* em agenda, prontuário e mapa de execução é uma oportunidade clara.
4. **Autosave que cria registro só por escolher o tipo** gera registros-lixo (vimos isso acontecer). Melhor criar em rascunho e persistir só com conteúdo.
5. **Prontuário rico, mas texto livre**: anamnese e exame físico são HTML de modelo. Campos estruturados (sinais vitais, SOAP, escore corporal, dor) permitem gráficos e IA.
6. **IA ausente**: não vimos resumo de histórico, transcrição de consulta, sugestão de diagnóstico ou receita, nem leitura de exame anexado.
7. **Microchip entre clínicas** (já temos) não existe neles. É um diferencial.
8. **Setup trabalhoso**: análise de estoque, comissões e mensagens exigem configuração prévia. Valem padrões inteligentes.

---

## 8. Comparação com o VetClinicManager hoje

O que já temos (React + Vite + Supabase, multi-tenant com RLS): Dashboard, Clientes, Animais, Agendamentos/Calendário, Prontuários, Vacinações, Microchips, Equipe, demo por visitante.

| Área SimplesVet | Nós | Prioridade sugerida |
|---|---|---|
| Ficha do animal com timeline única e 11 tipos de evento | Prontuários separados | **Alta**: é o coração do produto |
| Tipos de atendimento com modelo e etiquetas | — | **Alta** |
| Agenda por filas, escala, slots livres e fluxo de status | Calendário/agendamentos básicos | **Alta** |
| Protocolos de vacina com programação e encadeamento | Vacinações (registro) | **Alta** |
| Venda em atendimento → PDV → caixa | — | **Alta** (monetização da clínica) |
| Conta corrente do cliente (crédito/débito) | — | Média-alta |
| Produtos/serviços, estoque e análise | — | Média |
| Financeiro (lançamentos, DRE, contas a pagar) | — | Média |
| Perfis de acesso granulares | Equipe (papéis) | Média |
| Internação (boxes, prescrição, mapa de execução) | — | Média (módulo premium) |
| Comissões | — | Média-baixa |
| Mensagens automáticas, NPS, portal do tutor | — | Média-baixa |
| Fiscal (NFC-e, NFS-e) | — | Baixa no início (integrar com um emissor) |

**Sugestão de ordem de implementação:**
1. Ficha do animal com timeline e eventos.
2. Tipos de atendimento com modelos e variáveis.
3. Agenda com status e escala.
4. Protocolos de vacina.
5. Produtos e serviços com venda em atendimento e PDV/caixa.
6. Saldo do cliente.
7. Financeiro básico.

---

## 9. Observações sobre o estudo
- A "Clínica Exemplo" é **compartilhada entre todos os trials**: há registros de outros visitantes, inclusive "Teste Claude …" de outras sessões. Por isso navegamos ali só para ler.
- **Um registro foi criado sem querer na Clínica Exemplo**: um evento *Atendimento – Consulta Geral* em 29/10/2026 06:20 no animal **Rex (362)** do tutor Adalberto da Silva Junior (108). O próprio app cria o registro ao selecionar o tipo. A exclusão foi bloqueada pela política de permissões desta sessão; quem quiser removê-lo deve abrir o evento e usar **Excluir**.
- As telas Configuração de vendas, Perfis, Categorias e Mensagens são restritas na clínica exemplo e foram lidas na clínica própria do trial.
- Não foi possível ver por dentro: Fiscal (sem módulo ativo), Portal SimplesPet, NPS e Site (redirecionam para o upsell), e os passos 2–5 do cadastro de cliente (exigiriam salvar dados). Esses pontos foram complementados pela central de ajuda.

## 10. Fontes
- App: https://app.simples.vet (trial + Clínica Exemplo)
- Site e funcionalidades: https://simples.vet · https://simples.vet/funcionalidades/ · https://simples.vet/precos/
- Central de ajuda (28 coleções, ~800 artigos): https://suporte.simples.vet/pt-BR/
  - Atendimento clínico: https://suporte.simples.vet/pt-BR/collections/87646-atendimento-clinico
  - Agenda: https://suporte.simples.vet/pt-BR/collections/87523-agenda · fluxos: https://suporte.simples.vet/pt-BR/articles/592277
  - Vendas: https://suporte.simples.vet/pt-BR/collections/87497-vendas-para-operadores-de-caixa
  - Internação: https://suporte.simples.vet/pt-BR/collections/87489-modulo-de-internacao
  - Usuários e perfis: https://suporte.simples.vet/pt-BR/collections/87527-configurando-usuarios-e-perfis
  - Financeiro: https://suporte.simples.vet/pt-BR/collections/87532-curso-de-gerenciamento-financeiro
  - Comissões: https://suporte.simples.vet/pt-BR/collections/1594434-curso-sobre-comissionamento
  - Mensagens: https://suporte.simples.vet/pt-BR/collections/87501-modulo-de-mensagens
  - Vacinas: https://suporte.simples.vet/pt-BR/articles/10226458-guia-completo-vacinas
  - Saldo dos clientes: https://suporte.simples.vet/pt-BR/articles/6653110-o-que-e-o-saldo-dos-clientes
- Diretórios: https://www.b2bstack.com.br/product/simplesvet · https://www.capterra.com/p/216166/SimplesVet/ · https://www.trustradius.com/products/simplesvet · https://www.getapp.com/all-software/a/simplesvet/
