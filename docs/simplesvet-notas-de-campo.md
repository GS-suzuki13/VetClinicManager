# Notas de navegação SimplesVet

## Login (app.simples.vet/login/login.php)
- Coluna esquerda: logo, "Entrar no SimplesVet", Login (email), Senha, botão "Entrar no SimplesVet", "Recupere sua senha", link "Crie sua conta e experimente grátis" / "visite nosso site".
- Coluna direita: carrossel de banners com abas (Lançamento 25 usuários, Certificado digital no SimplesVet). Chat Intercom no canto inferior direito.
- Stack legado PHP (rotas *.php).

## Cadastro de experimentação (simples.vet/experimente/)
- Tela 1: apenas e-mail -> "Iniciar experimentação grátis" (7 dias, sem cartão). "Já tem uma conta? Fazer login".
- Wizard de 6 passos ("Bem vindo! Queremos te conhecer melhor...").
  - 2/6: "Sua empresa atende o plano de saúde Petlove?" Sim/Não -> Avançar/Voltar.
  - 4/6: "Qual o seu momento atual?" (Vou abrir um negócio logo / Tenho empresa, mas não uso sistema / Tenho sistema, mas quero um melhor / Meu sistema atual é caro / Sou só um curioso) + "Qual sua função?" (Proprietário de clínica ou petshop, Veterinário de clínica/hospital, Veterinário autônomo, Gestor, Recepcionista, Estudante, Consultor).
  - 6/6: verificação por SMS do celular (código), "Reenviar em 60s", "Acessar o SimplesVet agora", aceite de termos implícito ("Ao continuar...").
  - Cada passo tem um selo de argumento comercial no topo ("Respondemos em até 5 minutos", "Sem taxa de adesão...", "Importe seus dados com facilidade e sem custo"). Uso como funil de qualificação de lead (CRM de vendas).

## Shell do app (após login)
- Topbar: "Menu ☰" (drawer lateral à esquerda com busca), logo, botão verde "Fale com um especialista" (WhatsApp), "Novidades", avatar com iniciais + nome do usuário (dropdown), botão "Ajuda" (Intercom).
- Banner roxo fixo no rodapé de upsell (módulo de internação), bolha de chat Intercom.
- Página inicial da experimentação: /v3/administracao/sobre-simplesvet (cards de onboarding: módulos adicionais, diferenciais, usuários sem login, contrate, navegue, telefones, cadastre equipe, demonstração gratuita, treinamentos em vídeo).
- Front-end: Vue (data-v-*), ícones mask SVG de icones.simples.vet (Streamline). 3 gerações de telas: PHP legado (*.php), /v2/ e /v3/ (SPA Vue).

## Mapa completo do menu
- Conheça o SimplesVet -> /v3/administracao/sobre-simplesvet
- Painel de controle -> /principal/dashboard.php
- Atendimento clínico -> /principal/cliente/cliente.php
- Clientes -> /v3/cliente/clientes
- Agenda > Agenda /agenda/agenda.php | Escala /escala/escala.php | Configuração /config/agenda/agenda.php
- Vendas > Ponto de venda /principal/pontodevenda/venda.php | Minhas vendas /v2/inteligencia/produtividade/minhas-vendas | Movimentos de caixa /consulta/caixamovimento/caixa.php | Consulta vendas /principal/venda/venda.php | Pacotes vendidos /v3/comercial/pacotes-vendidos | Recebimentos /consulta/recebimento/recebimento.php | Lista de preços /v3/comercial/lista-precos | Ranking de clientes /v3/cliente/ranking-clientes | Saldo dos clientes /v3/cliente/saldo-clientes | Formas de recebimento /v3/financeiro/formas-recebimento | Modelo de orçamento /config/modeloorcamento/modeloorcamento.php | Modelo de demonstrativo /config/modelodemonstrativo/modelodemonstrativo.php | Configuração /venda/configuracao/configuracao.php
- Comissionamento > Comissões em aberto /v2/comercial/comissao/fechamento | Extratos /v2/comercial/comissao/extratos
- Inteligência > Produtividade /v2/inteligencia/produtividade | Vendas /v2/inteligencia/vendas
- Consultas > Vacinação /consulta/vacina/vacina.php | Aniversários /consulta/aniversario/aniversario.php | Log /v3/ambiente/logs
- Cadastros > Espécies /v3/veterinaria/especies | Raças /v3/veterinaria/racas | Pelagens /v3/veterinaria/pelagens | Patologias /v3/veterinaria/patologias | Tipos de atendimento /cadastro/tipoatendimento/tipoatendimento.php | Vacinas /cadastro/vacina/vacina.php | Exames /cadastro/exame/exame.php | Atributos de exames /cadastro/exameatributo/exameatributo.php | Referências de exames /cadastro/examereferencia/examereferencia.php | Modelo de receita /config/modeloreceita/modeloreceita.php | Origem dos clientes /v3/veterinaria/origem-dos-clientes | Modelo de documento /config/modelodocumento/modelodocumento.php
- Internação > Animais internados /internamento/internamento/dashboard.php | Mapa de Execução /internamento/execucao/execucao.php | Histórico de Internações /internamento/internamento/internamento.php | Parâmetros clínicos /v3/internacao/parametros-clinicos | Modelos de prescrição /internamento/prescricaomodelo/prescricaomodeloitem.php | Boxes /v3/internacao/boxes
- Estoque e serviços > Produtos e Serviços /v3/comercial/produtos-servicos | Compras /cadastro/compra/compra.php | Outras saídas de estoque /v3/comercial/outras-saidas-de-estoque | Análise de estoque /v3/comercial/analise-estoque | Inventário /v3/comercial/inventarios | Pedido de compra /v3/comercial/pedidos-compra | Grupos de Produtos /v3/comercial/grupos-de-produtos | Marcas /v3/comercial/marcas | Produtos recomendados /cadastro/produtorecomendado/produto.php
- Financeiro > Lançamentos /financeiro/lancamento/lancamento.php | Conciliação de cartões /v3/financeiro/conciliacao-cartoes | Contas a pagar /v3/financeiro/contas-a-pagar | Demonstrativo /financeiro/demonstrativo/demonstrativo.php | Fluxo de caixa /financeiro/fluxocaixa/fluxocaixa.php | Contas e cartões /financeiro/conta/conta.php | Categorias /financeiro/categoria/categoria.php | Fornecedores /v3/comercial/fornecedores | Formas de pagamento /cadastro/formapagamento/formapagamento.php
- Beta > Animais /consulta/animal/animal.php | Atendimentos /consulta/atendimento/atendimento.php
- Configuração > Empresa /config/clinica/clinica.php | Usuários /v3/ambiente/usuarios | Acesso externo /config/restricao/restricao.php | Perfil de Acesso /config/perfil/perfil.php
- Fiscal > Notas de serviço /v3/fiscal/nfse | Notas de produto /fiscal/outbound/outbound.php | Perfis Tributários /fiscal/regratributaria/regratributaria.php
- Site > Configurações /site/info/info.php | Slideshow /site/slide/slide.php | Destaques /site/destaque/destaque.php | Páginas /site/pagina/pagina.php | Mensagens /site/mensagem/mensagem.php
- Portal SimplesPet > Configurações /portal/parametro/parametro.php | Clientes /v3/relacionamento/portal/usuarios | Convites /portal/convite/convite.php
- Mensagens > Histórico /v3/relacionamento/mensagem/mensagens | Créditos e consumo /v3/relacionamento/mensagem/creditos-consumos | Mensagens automáticas /v3/relacionamento/mensagem/mensagens-automaticas | Campanha SMS /alerta/campanha/campanha.php | E-mails inválidos /v3/relacionamento/mensagem/descadastrados
- Pesquisa de satisfação > Configuração /nps/configuracao/configuracao.php | Respostas /nps/consulta/consulta.php | Painel /nps/consulta/painel.php
- Mapa do Sucesso /sucesso/index.php | Treinamentos treinamento.simples.vet | Indique /indicacao/indicacao.php | Sair /login/logout.php

## Painel de controle (/principal/dashboard.php) — legado PHP/Bootstrap 2
- Abas: Principal | Financeiro. Botão "Configurar" entra em modo edição: widgets arrastáveis (✚), lixeira, "+ Clique para adicionar novo Widget", "+ Adicionar Indicador", "Concluir".
- Widgets disponíveis: Animais internados, Animais por ano, Animais por mês, Aniversariantes de hoje, Ciclo de vida dos clientes, Comunicados, Consultas por mês, Contas a pagar, Estoque abaixo do mínimo, Respostas de SMS, Últimos acessos, Últimos animais cadastrados, Últimos atendimentos (24h), Vacinas, Venda líquida diária, Vendas líquida mensal. (Aba Financeiro: Saldos, Lançamentos vencidos, Lançamentos recentes, Maiores despesas no mês, Saldo diário, Fluxo de caixa.)
- Indicadores (cards coloridos à direita): Investimentos, NPS, Receitas/despesas/resultado do mês, Saldo em conta, Saldo para mensagens, Venda Bruta. Na clínica exemplo: Animais (904), Responsáveis (797), Venda Líq./mês, Débitos/clientes, Descontos/mês %, Ticket médio/mês, Média espera, Média atendimento.
- Gráficos atualizados a cada 24h (pré-agregados). Empty states didáticos ("Você não cadastrou pets... Realize o cadastro através do menu Clientes").
- Experimentação: botão "Acessar Clínica Exemplo" troca de ambiente (tenant demo compartilhado, cabeçalho fica azul). Multi-tenant com troca de ambiente.

## Atendimento clínico (/principal/cliente/cliente.php)
- Busca: Responsável, Animal, [buscar], [filtro avançado laranja], [limpar], "+ Adicionar".
- Filtro avançado: CPF, Marcação responsável, Telefone, Email, Origem; Espécie, Status do animal (Vivo/Óbito), Sexo (Macho/Fêmea/Indeterminado), Esterilização, Faixa de idade (até 1m, 1-3m, 3-6m, 6m-1a, 1-3a, 3-5a, 5-7a, 7-12a, 12-20a, 20-30a, 30-40a, >40a); Microchip, Marcação animal, Patologia, Raça, Ciclo de vida; CEP, Bairro, Endereço.
- Origens padrão: Facebook, Fachada da loja, Google, Indicação de amigo, Indicação de veterinário, Instagram, Panfleto, Rádio, Revista.
- CICLO DE VIDA do cliente (regra de negócio por data do último retorno): Clientes ativos [Retornou há <1 mês; 1-3 meses; 3-6 meses; 6m-1 ano] / Necessitam de atenção [1-2 anos; 2-3 anos] / Abandonaram [3-5 anos; >5 anos] / Arquivados.
- Lista: Nome do responsável (código) | Animais (links; ativos azul, óbito/inativos cinza).

## FICHA DO ANIMAL / PRONTUÁRIO (abre na mesma URL, cliente.php, via AJAX; título "Rex - Adalberto ...")
- Cabeçalho tutor: nome (código), telefones com tipo (Celular/Residencial), email; TAGS coloridas: vermelho "Saldo devedor de R$ 492,50"; laranja = marcações/observações do cliente (ex.: "Perfume", "apenas bandana", "alergico a shampo de camomila").
- Cabeçalho animal: nome (código), Sexo + Castrado, último peso com data ("5kg em Set de 2025"), idade ("4 anos, 6 meses"), avatar por espécie, badge vermelho "Animal Internado". [x] fecha a ficha.
- Botões de ficha: "Enviar mensagem", "Mais ações", "Editar animal".
- Coluna esquerda (recolhível "<"): abas Venda (?) | Orçamentos. "+ Adicionar" (split button c/ dropdown) adiciona itens à VENDA EM ATENDIMENTO, que fica em aberto e vai ao PDV para baixa.
- Abas centrais: Histórico | Protocolos | Linha do tempo | Agenda | Vendas.
- Barra do Histórico: filtro "Período..." (dropdown), desfazer filtro, 11 ícones de filtro por tipo de evento (atendimento, peso, patologia, documento, exame, foto, vacina, receita, observação, vídeo, internamento) + "todos | nenhum", botão imprimir (Relatório PDF), expandir/recolher.
- Timeline vertical agrupada por ano: cada item = data "dd/mm às hh:mm", tipo, subtipo (ex. "Consulta Geral", "Hemograma", "Admissão em internação", "Triagem") e avatar com iniciais do usuário autor (GG, OM, L). Borda colorida por tipo.
- Painel direito "Adicionar": 11 tiles coloridos: Atendimento (azul), Peso (marrom), Patologia (roxo), Documento (verde), Exame (vermelho), Fotos (azul escuro), Vacina (amarelo), Receita (lilás), Observações (cinza), Vídeo (verde escuro), Internação (bordô).

### Formulários de evento
- ATENDIMENTO "Atendimento em dd/mm hh:mm" / "Por <usuário>": Tipo do atendimento* (select do cadastro Tipos de atendimento) + Resumo (texto). Ao escolher o tipo carrega o MODELO (anamnese) do tipo em editor rich text (CKEditor: Estilo, Formatação, Fonte, Tamanho, cor, B/I/U, listas, citação, tabela, alinhamento, desfazer/refazer, quebra de página, imagem) com VARIÁVEIS JÁ MESCLADAS (nome/código do animal, sexo, castrado, idade, nascimento, espécie, peso, vacinas aplicadas/programadas em tabela, dados do tutor: nome, código, RG, CPF, telefones, outros animais, veterinário, telefone e razão social da clínica, cidade, data por extenso, etc.).
  - "salvar a cada 20s" (AUTOSAVE, marcado por padrão). REGRA OBSERVADA: ao escolher o tipo o atendimento JÁ É CRIADO e aparece na timeline (rascunho persistido imediatamente).
  - Anexos (upload múltiplo files[]), "Agendamento de retorno" (data age_dat_programada) / "Excluir retorno".
  - Botões: Salvar (verde), Imprimir (A4/A5, split com "Configurar impressão": cabeçalho, margem), Fechar; em registro existente: Excluir (confirma "Deseja realmente excluir o registro?" Não/Sim), Log (auditoria).
- PESO: Peso (decimal) + Anotação. Salvar/Cancelar.
- PATOLOGIA: select do cadastro de patologias (ex.: Cinomose, Coronavírus, Erlichiose, Hepatite infecciosa, Leishmaniose, Leptospirose, Parvovirose, Raiva, Tosse canina, Tríade felina...).
- DOCUMENTO: select Modelo de documento (Atestado de aplicação de vacina, Atestado de óbito, Atestado de saúde, Atestado de vacinação (completo/resumido), Guia de trânsito, Receituário, Receituário de Controle Especial, Solicitação de Exame, TCLE, Relatório de saldo...) -> gera texto mesclado; Salvar/Imprimir.
- EXAME: select do cadastro de Exames (Hemograma, Bioquímico, Citologias, Cultura fúngica, Ecocardiograma, Eletrocardiograma, Parasitológico de fezes, Contagem de reticulócitos, Análise de líquidos cavitários...) -> carrega atributos e valores de referência; Salvar/Imprimir.
- FOTOS: upload múltiplo + Resumo.
- VACINA: abre aba Protocolos: seções "Vacinas" / "Antiparasitário"; Adicionar: Tipo* (Vacinas | Vermífugos | Antiparasitário), Protocolo* (Vacina - Protocolo, ex. "Giárdia - Filhote (2 x 21 dias)", "Octavalente - protocolo 1", "Leishmaniose - Anual", "RAIVA - Dose única"), Data inicial* -> sistema programa as doses.
- Tile INTERNAÇÃO: se o animal já está internado, abre a Ficha de Internação existente (/internamento/internamento/dashboard.php); senão inicia nova internação.

## FICHA DE INTERNAÇÃO (Internação > Animais internados)
- Cabeçalho: Animal (código), espécie, sexo, idade, peso; tutor (código) + ícone telefone. Badge de RISCO ("Urgente"), "Internado no box BOX 7 (BOX 7B)", previsão de alta ("Sem previsão de alta"), Duração (112 Dias 18 horas, calculada desde admissão), Veterinário responsável.
- Ações: Editar | Alta | Óbito | Box | Cancelar | Imprimir. Refresh no topo.
- Abas: Histórico | Prescrição Médica.
- Histórico: botões Ocorrência, Enviar mensagem (SMS/Email/WhatsApp ao tutor = comunicados), Peso, Relatório Médico; filtros por ícone: remanejamento (mudança de box), ocorrência, relatório, comunicado, peso, prescrição, (admissão/parâmetros); "todos | nenhum"; ordenação (mais recentes/mais antigos no topo). Timeline vertical com cards coloridos: "Registrado por X em dd/mm/aa às hh:mm", avatar do autor, lápis para editar.
  - Eventos observados: Triagem (Situação: Triagem; Box; Risco; Queixa; Diagnóstico; Prognóstico; Marcações) -> Admissão em internação (Box, Risco, Queixa, Diagnóstico, Prognóstico, Marcações) -> Inserção de Prescrição ("Dipirona gotas, 1 Gota(s), via ORAL, a cada 8 horas, por 3 dias") -> Relatório médico (texto rico).
- Prescrição Médica: navegação por dia (< 29/10/2026 >), "+ Prescrição", "Salvar como modelo" (gera Modelo de prescrição). Empty state: "Clique no botão em destaque e adicione o primeiro procedimento."
- Modal PRESCRIÇÃO: Tipo* [Procedimento | Medicamento | Fluidoterapia]; Frequência* [Recorrente | Apenas 1 vez | Quando Necessário]; A cada* N [Hora(s)|Dia(s)]; Por* N [Hora(s)|Dia(s)|Vez(es)]; Iniciar em* data + Hora*; Resumo gerado automaticamente ("iniciando em 29/10/2026 às 06:24").
  - Procedimento: Procedimento* (texto).
  - Medicamento: Medicamento* (busca produto), Unidade* [Borrifada, Cápsula, cm, Comprimido, Drágea, g, Gota(s), l, mcg, Medida, mg, ml, Sachê, UI, UN, g/kg, Gotas/kg, mcg/kg, mg/kg, ml/kg, UI/kg], Dose*, Via* [Enema, Epidural, Inalatória, Intramuscular, Intraóssea, Intraperitoneal, Intravenosa, Oftálmica, Oral, Otológica, Sonda, Subcutânea, Tópica], Peso (pré-preenchido com último peso "5 kg em 16/09/2025") -> dose por kg calculada.
  - Fluidoterapia: Fluido*, Equipo* [Macro Gotas|Micro Gotas], Unidade*, Dose*, Via* [Enema, Epidural, Intraóssea, Intraperitoneal, Intravenosa, Oral, Sonda, Subcutânea], Velocidade* [gotas/min | ml/h | ml/dia], Suplemento.
  - Prescrições geram tarefas no MAPA DE EXECUÇÃO.
- Modal ALTA: "Esta opção encerrará a internação com status de 'Alta' e interromperá todos os procedimentos ainda não realizados." Veterinário*, Data*, Hora*, Relatório de alta*.
- Modal ÓBITO "Confirmar óbito": Veterinário*, Data*, Hora*, Causa*, Relatório de óbito*, checkbox obrigatório "Confirmo que o animal X veio a óbito." Regra: não permite novas prescrições/parâmetros; animal fica com status Óbito.
- Modal BOX "Alterar Box do animal": mover, atribuir ou retirar ("Sem box definido"); select lista boxes com ocupante ("BOX 7 - Rex", "Baia 1 - Nala").
- Modal OCORRÊNCIA: "Registre rapidamente ocorrências relevantes ao Veterinário para ajudá-lo na criação do relatório médico." Data*, Hora*, Resumo*, Descrição*.
- Modal PESO: Data*, Hora*, Peso* kg, Anotação + gráfico "Histórico de peso".
- Modal RELATÓRIO MÉDICO: Descrição* (rich text), Resumo.

## ANIMAIS INTERNADOS (dashboard /internamento/internamento/dashboard.php)
- Seções "Internados" e "Triagem" (animais em triagem ainda sem admissão).
- Grade de cards (4 col): faixa lateral colorida = RISCO (verde, amarelo, laranja, vermelho, azul claro), Nome (código), espécie/raça, peso, "Alta prevista dd/mm/aa" (vermelho quando vencida) ou "Sem previsão de alta", "Duração: N Dias H horas", box (ex. "BOX 7B"), foto/iniciais do veterinário responsável, ícone (i) abre ficha. Botão refresh.

## MAPA DE EXECUÇÃO (/internamento/execucao/execucao.php)
- Filtros: Animal (texto), select [Programadas e vencidas | Todas as prescrições], buscar, limpar; navegação de data (< dd/mm/aaaa >), refresh, imprimir.
- Grade: linhas = animais internados (faixa de risco, nome (código), espécie/sexo/peso, box); colunas = horas 00..23 (hora atual destacada em cinza). Células com bolha contendo nº de tarefas: VERMELHA = vencida/atrasada, AZUL = programada (verde provavelmente concluída).
- Clique na bolha -> modal "Programação": animal, "Programação para dd/mm/aaaa às hh:mm", lista de procedimentos (ícone de relógio vermelho se atrasado); rodapé: Ocorrência | Peso | + Parâmetros Clínicos | Fechar.
- Clique no procedimento -> modal "Agendamento" (execução): Procedimento*, Situação [Concluida | Programada], Programado para, Realizado em* data + Hora* + botão "Agora", Observações. Salvar/Fechar.
- Modal PARÂMETROS CLÍNICOS: "Registro em" data/hora + "Agora"; tabela Parâmetro | Resultado | Complemento. Cada parâmetro cadastrado é texto livre OU lista de opções pré-definidas (ex.: Temperatura [Com febre/Sem febre], Frequência Cardíaca [Taquicardia/bradicardia/normal], Fezes, Comportamento [Ativo/Calmo], Apetite [Aceitou alimentação], Vômito [SIM/NÃO], Glicemia [Hiper/Hipo/Normal], PAS/Pressão arterial (texto)).

## HISTÓRICO DE INTERNAÇÕES (/internamento/internamento/internamento.php)
- Filtros: Animal, Responsável, Situação [Todas | Triagem + Internado | Triagem | Internado | Cancelado | Alta | Óbito], período (date range "01/10/2026 até 31/10/2026" com << < > >>), botão "Relatórios".
- STATUS da internação: Triagem -> Internado -> Alta | Óbito | Cancelado (pode reabrir).
- RISCO: "Urgente", "Não urgente" (+ outros níveis por cor; Triagem tipo Manchester simplificada).
- Colunas: Animal (código, espécie, sexo) | Responsável | Box | Risco | Veterinário (iniciais) | Situação | Admissão | Duração | Alta / Prev.

## Cadastros da internação
- Parâmetros clínicos (/v3/internacao/parametros-clinicos): Nome | Opções de resposta (lista separada por vírgula; vazio = texto livre).
- Boxes (/v3/internacao/boxes): Nome | Sigla (ex.: "Leito 1 (UTI)" / "L1 UTI", "Box 1 para gatos" / "BOX CAT 01").
- Modelos de prescrição (legado): lista de modelos à esquerda; cada modelo tem itens (Tipo | Resumo), "+ Adicionar", "Adicionar item". Ex.: "Medicamento: WeBiotic - Comprimidos, 1,00 Comprimido, via Oral, a cada 1 dia, por 7 dias"; "Procedimento: 5 ML VIA SONDA, a cada 3 horas, por 4 vez(es)". Aplicado na prescrição; criado também via "Salvar como modelo".

## MÓDULOS/ASSINATURA (extraído do JS da agenda)
Assinatura possui serviços (mod_var_chave) com status e preço: PORTAL (Portal SimplesPet, R$0), INTERNACAO (R$39 legado), NPS (R$0), SITE (Site expresso, R$0), COMISSAO (R$0), NFCE (R$69, Inativa), INTELIGENCIA (R$0). Campos: ser_int_diasexperimentacao, ase_cha_status (ATI), pla_int_codigo (plano). => feature flags por módulo/assinatura, menus aparecem conforme módulo ativo.
- Convenção de nomes do banco (legado): prefixo de 3 letras da tabela + tipo + nome: ani_var_nome, ani_cha_sexo (char), ani_int_idademes, pes_var_nome (pessoa), esp_int_codigo (espécie), tat_int_codigo (tipo atendimento), aat_var_resumo (atendimento), anp_dec_peso (animal peso), pat_int_codigo (patologia), mdo_int_codigo (modelo doc), exa_int_codigo (exame), vpr_int_codigo (vacina protocolo), tva_int_codigo (tipo vacina), avp_dat_inicio, pre_cha_* (prescrição), pag_* (programação/agendamento de prescrição), ied_var_resultado (internação evento dado/parâmetro), box_int_codigo, int_cha_status (internação), usu_int_codigoveterinario, ope_int_codigo (origem pessoa). Tipos: var=varchar, int, dec, cha=char/enum, dat=date, dtf=datetime, txt=text.

## AGENDA (/agenda/index.php — "Agenda diária", V2)
- Topo: [Dia | Semana | Mês], "+ Adicionar", Filtro (laranja), Atualizar, Chave inglesa (dropdown: Configuração, Comunicados, Escalas), Imprimir. Navegação < "29/10/2026 - quinta-feira" >.
- Visão DIA: uma COLUNA POR FILA/PROFISSIONAL (nome + áreas "Clínica, Banho e Tosa", ícone ? e impressora por coluna); régua de horas à esquerda; só exibe a faixa da escala; slots de 20 min (linhas pontilhadas). Cards arrastáveis (drag&drop para remarcar) com altura = duração: "Tutor - Pet", ícone de nota se tem observação, hora, tipo de atendimento. Cor do card = status (Agendado cinza claro #eee, Em espera laranja #eda831, etc.).
- Visão SEMANA: colunas Domingo..Sábado com cards "hh:mm - Tutor - Pet / Profissional - Tipo", borda direita colorida por status (cinza=agendado, laranja=espera, vermelho=atrasado, verde=atendido, preto=?).
- DRAWER do evento (slider lateral direito) "Evento em dd/mm/aaaa às hh:mm": status no topo (cor), tutor (código), pet (código) espécie/pelagem, telefone, avatar; botões Ficha (abre prontuário), Mensagem ▾ (SMS/Email/WhatsApp), Histórico de mensagens; "+" (laranja) inserir produtos/serviços (gera venda); tipo de atendimento; profissional. Botão primário = PRÓXIMO PASSO do fluxo (ex. em espera -> "Iniciar"). Editar agendamento | Cancelar agendamento. Rodapé: Fechar, Imprimir, Tornar recorrente/Editar recorrência, Pesquisar, Cadeado "Habilitar todas as ações" (mostra todas transições: Marcar como agendado, Confirmar agendamento, Iniciar atendimento, Finalizar atendimento), Excluir (lixeira), Log.
- FORM AGENDAMENTO (Editar/Adicionar): Cliente (Trocar cliente / Pesquisar cliente, select2; pode agendar sem cadastro), Tipo de atendimento (caretype), Duração (5 min ... 12 horas), Data (scheduled_date), Fila/Profissional (queue), Horário (scheduled_hour = SOMENTE HORÁRIOS LIVRES calculados pela escala, de 20 em 20 min, "29/10 às 12:20 - Fábio Castro"), Observações (comments), Status [Agendado, Em espera, Em atendimento, Cancelado, Atrasado, Animal pronto, Confirmado], "Inserir produtos / serviços", Salvar.
- FILTRO: Áreas [Clínica | Banho e Tosa] (multi), Tipo de atendimento (multi), Status (multi: Agendado, Em espera, Em atendimento, Atendido, Cancelado, Atrasado, Animal pronto, Confirmado), Cliente, Filas (Todos/Nenhum/checkbox por profissional). Aplicar filtro | Fechar | Limpar filtros.
- STATUS (help center): fluxo Clínico: Agendado(cinza) -> Confirmado -> Em espera -> Em atendimento(azul) -> Atendido(verde); Atrasado(vermelho); Cancelado(preto). Fluxo Banho e Tosa: ... -> Em atendimento -> Animal pronto -> Atendido (ao sair). Fluxo Simplificado: Agendado -> Em espera -> Em atendimento -> Atendido. Fluxo definido pelo Tipo de atendimento.
- Tempo médio de espera = (início atendimento - chegada/em espera); tempo médio de atendimento = (fim - início) -> alimenta indicadores do painel.

## ESCALA (/escala/escala.php)
- Navegação por mês (< 10/2026 >), "Confirmar o mês inteiro", "+ Adicionar". Lista por dia: "01/10 (quinta-feira)" -> linhas Profissional | 06:00 - 18:00 | checkbox de confirmação (por dia e por profissional).
- Form Escala (drawer): Fila* (profissional), Data*, Horários (+ Adicionar horário; múltiplos intervalos), Inserir/Fechar.
- Regra: escala gerada a partir do horário de atendimento do funcionário; pode ter escalas extras e escalas variáveis; slots livres da agenda derivam da escala.

## CONFIGURAÇÕES DA AGENDA (/config/agenda/agenda.php)
- Botão "Usuários". Horário de funcionamento da empresa: Dias | Início | Término (Seg..Sáb 06:00-18:00).
- "Usuários que possuem Agenda": nome, perfil (Administrador do sistema), áreas (Clínica, Banho e Tosa), Atendimento (dias e horário).
- "Próximos bloqueios gerais": + Adicionar | Ver histórico (bloqueios pontuais/recorrentes, ex. feriados).

## CLIENTES v3 (/v3/cliente/clientes)
- Topo: busca "Nome, código, celular, e-mail ou CPF", (+) azul novo, filtro (laranja), (...) mais.
- Tabela: Nome | Código | Animais (links). Linha clicada fica azul e abre DRAWER lateral direito (/v3/cliente/clientes/{id}).
- NOVO CLIENTE: wizard 5 passos ("Informações do cliente 1/5", barra de progresso, "Avançar"). Passo 1: toggle Pessoa física | Pessoa jurídica.
  - PF: Nome completo*, Nacionalidade* [Brasileiro|Estrangeiro], Sexo, CPF, RG, Aniversário, Como nos conheceu? (origem), Profissão, Inscrição municipal (só p/ NFS-e).
  - PJ: Nome completo*, Nacionalidade*, CNPJ, Regime tributário [Normal|Simples Nacional], Inscrição municipal, Tipo de inscrição estadual* [Contribuinte de ICMS | Não contribuinte | Isento], Como nos conheceu?.
  - Passos seguintes (pelo help/visualização): Contatos (celular c/ flag WhatsApp, residencial, e-mail), Endereço (CEP auto), Privacidade/Canais (E-mail, Campanha SMS, SMS, WhatsApp - opt-in LGPD), Animais/Marcações.
- VISUALIZAR CLIENTE (drawer): header nome + botão WhatsApp (verde) + (...) "Mais ações" [Enviar convite para o Portal | Enviar mensagem por SMS ou Email | Histórico de mensagens | Histórico de alterações | Excluir].
  - Aba Responsável, cards: Dados do responsável (Nome, Código, Marcações em tags laranja, "Ver mais"); Saldo (Saldo R$ 492,50 vermelho, Situação "Em débito" badge); Pacotes (Pacotes ativos + Animal); Agendamentos (próximos, até 5: "10/11 às 08:20 (Ter) - Banho e tosa - Steve"); Contatos (Celular (Whatsapp), Residencial, E-mail); Privacidade (Canais de comunicação aceitos); Endereço; Portal do cliente (status de cadastro no portal).
  - Aba Animais: "Adicionar animal" + cards: Espécie, Nome, Sexo, pelagem, Código, Esterilização (Castrado/Fértil), Nascimento, Pedigree, status Vivo/Óbito.
- NOVO ANIMAL (drawer): Nome do animal*, Sexo [Macho/Fêmea/Indeterminado], Esterilização (habilita após sexo), Nascimento (datepicker), Espécie, Raça (filtrada pela espécie), Pelagem, Microchip; "Mais campos": Pedigree [Sim/Não], Nº do Pedigree, Enviar imagem (foto). Salvar.

## PONTO DE VENDA (/principal/pontodevenda/venda.php)
- Layout 2 colunas: esquerda "Nova venda" (card azul), direita "Outros caixas" (+ Novo caixa | Meus caixas) e "Vendas" (refresh, "Localizar venda", navegação < Últimas 24h ▾ >, lista de vendas: Cliente / Pet / código / valor em badge vermelho; abas Não pago | Pago).
- Nova venda: Data* (?: "Não é permitido alterar hora para vendas de hoje"), Tipo* [Venda | Orçamento] (permissão p/ transformar em orçamento), Tipo de venda* (usado no fiscal: Presencial consumidor final | Presencial revenda | Delivery ou atendimento domiciliar | Delivery revenda | Pedido via internet c/ transportador | Pedido via telefone c/ transportador).
  - Cliente: Responsável, Animal (nome ou ficha), pesquisar, filtro avançado, limpar ("Preencha um ou mais campos..."). Venda SEM cliente e SEM pet é permitida.
  - Produtos e Serviços: Funcionário (vendedor/comissionado, default usuário logado) | − Qtd + | "Nome, código ou leitura cod. barra" | buscar. Itens com Valor por unidade e Valor do item editáveis.
  - Observações ("serão impressas no demonstrativo de venda ou orçamento").
  - Botões: Registrar recebimento (verde), Salvar (fica em aberto), Cancelar.
- RESUMO da venda: Código, Tipo, Status (badge "Aberto"), Data, Usuário, Responsável (código), Telefones; "Saldo devedor: R$ 650,00 (ver detalhes)"; itens AGRUPADOS POR ANIMAL (nome, código, raça) e por data: Produto/Serviço (código) | Funcionários | Valor; Total líquido, Total em aberto; Observações. Botões: Editar, Excluir (lixeira), Pesquisar/log, Registrar recebimento, Mensagem (enviar demonstrativo), Imprimir ▴ (recibo/demonstrativo), Voltar, Conceder desconto.
- STATUS da venda: Em atendimento (lançada pela ficha/agenda/internação, ainda não finalizada) -> Aberto -> Baixada parcial -> Baixada (Pago); Orçamento (com validade); devolvida.
- MODAL REGISTRAR RECEBIMENTO: "Vendas em aberto: R$ X"; Caixa* (caixas abertos, ex. "Novo CX - 29/10"), Data* (bloqueada = hoje; retroativa só com permissão); N linhas de [Forma de recebimento | Valor | Parcelas] + Remover; "+ Adicionar forma de recebimento" (pagamento misto); Total pago; campo NSU/código de transação do cartão (p/ conciliação); uso de CRÉDITO do cliente ("Clique para alterar o valor do crédito a ser utilizado"); troco calculado. 
  - Formas de recebimento = adquirente + bandeira + modalidade (ex. "Cielo Master Card Crédito", "Cielo Elo Débito", "InfinitePay Pix", "Rede...", "Mercado Pago Visa Crédito", "Dinheiro", "Boleto", "Cheque", "Cobrança recorrente por link"), com parcelas.
- MODAL CONCEDER DESCONTO: Total bruto, Tipo [R$ | %], Valor, Total líquido; "Ao aplicar esse desconto, o valor será redistribuído em todos os itens." (rateio proporcional; respeita limite de desconto do perfil).
- MODAL NOVO CAIXA = "Abrir caixa com Suprimento": Conta de origem (contas financeiras: Banco, Cofre, Fundo Fixo...), Valor R$, Forma [Dinheiro], Descrição. Múltiplos caixas abertos por usuário.
- Configuração de vendas (/venda/configuracao) exige permissão de administrador ("Permissão negada" page: /errors/perm.php?url=...).

## MOVIMENTOS DE CAIXA (/consulta/caixamovimento/caixa.php)
- Filtros: data, Usuário (Todos os caixas | por operador), Cód. Caixa, Status do caixa [Aberto | Fechado | Encerrado | Em revisão].
- Ciclo do caixa: Aberto (suprimento inicial) -> movimentos (vendas, suprimento, sangria, despesa, transferência entre caixas) -> Fechado (conferência) -> Encerrado/Em revisão (gestor revisa diferenças).

## PRODUTOS E SERVIÇOS (v3 /v3/comercial/produtos-servicos)
- Topo: busca "Nome, código ou código de barras", (+), filtro, imprimir (etiquetas/lista), (...). Card alerta vermelho "5 Com validade vencida" (clicável/filtro).
- Tabela: Nome | Código | Validade (vermelho se vencida) | Estoque | Custo | Markup | Preço de venda | Situação do estoque (badge: Excesso roxo, Repor vermelho, Parado laranja, Novo). Estoque pode ficar NEGATIVO (venda sem estoque permitida por config).
- ADICIONAR (wizard/acordeão c/ "Avançar"): 
  - Dados básicos: Tipo* [Produto | Serviço | Pacote | Kit], Código de barras, Nome*, Unidade de venda* (UN, DEZ, ML...), Marca, Grupo ao qual pertence* (grupos/subgrupos).
  - Preço: Propósito* (Venda | Consumo interno | Venda e consumo interno), Custo de aquisição, Markup desejado, Preço de venda sugerido (= custo × (1+markup)), Preço de venda*, Exibe na lista de preço, Permite alterar preço na venda.
  - Fiscal: Código NCM, EX TIPI, CEST, NVE (+ perfil tributário).
  - Estoque: Estoque atual, Validade (controla validade? lotes), Validade mais antiga, Estoque mínimo.
  - Áreas: Banho e Tosa | Clínica | Petshop (onde o item aparece).
  - (Comissão e Limite de desconto por item.)
- VISUALIZAR PRODUTO (drawer /produtos-servicos/{id}): Informações gerais (Nome, Tipo, Unidade, Marca, Código, Código de barras, Grupo, Áreas); Custo e preço (Preço, Custo, Propósito, Markup desejado vs MARKUP REAL calculado = preço/custo-1, flags); ESTOQUE: Estoque atual, Situação (Repor), Custo total do estoque (=qtd×custo), Estoque mínimo, Média mensal de saída, Duração estimada (dias = estoque / média diária), Sugestão de compra, Estoque ideal (faixa "Entre 6 e 4"), link "entenda os cálculos da análise de estoque"; Validade; SAÍDAS últimos 3 meses (Vendas / Consumo interno / Total por mês); ENTRADAS últimos 3 meses; Comissões ("Produto não comissionado"); Fiscal ("Recomendamos preencher..."); LIMITE DE DESCONTO ("Obedece limite da empresa e usuários. A empresa não possui um limite padrão cadastrado, por isso o produto não poderá receber desconto, exceto para usuários que possuem limites específicos").
- REGRA LIMITE DE DESCONTO: hierarquia produto -> empresa -> usuário (usuário pode ter limite específico).

## FINANCEIRO
### Contas a pagar (v3 /v3/financeiro/contas-a-pagar)
- Busca "Descrição", (+), filtro, imprimir, (...). Seletor de período (< "Esta semana" 📅 >).
- Cards-resumo/abas (scroll horizontal): Não pagos | Pagos (verde) | Vencidos (vermelho) | A vencer (laranja) | Todos — cada um com total R$.
- Tabela: Data | Descrição | Categoria | Fornecedor | Parcela | Valor | Status (badge "A vencer").
### Lançamentos (legado /financeiro/lancamento/lancamento.php) — extrato/livro-caixa
- Filtros: Conta (Todas | contas bancárias | espécie | "Vendas em aberto" | "Caixa - <usuário>" um por operador), Categoria (árvore), buscar, filtro avançado, limpar; "+ Adicionar", "Transferência", imprimir. Navegação por dia/período (< 📅 29/10/2026 ▾ >). Abas Resumo | Lançamentos.
- Tabela: Data | Descrição/Documento | Fornecedor/Forma | Parcela ("2 de 10") | Valor (azul receita, vermelho despesa) | Saldo (acumulado) | Ação (✔ verde = confirmado/pago; ícone ⤭ = transferência). Linha "Saldo anterior"; rodapé Total de receita / Total de despesa / saldo.
- INTEGRAÇÃO: baixa de venda gera "Baixa venda 1096 - Junior - Caixa 479" na conta da forma de recebimento (ex. "Mercado Pago Visa Crédito" é uma conta do tipo Recebimentos) com parcelas; depois "Depósito <forma> para <banco>" (transferência automática pela previsão de recebimento da adquirente, D+N, com taxa). 
- FORM LANÇAMENTO (Adicionar): abas Geral | Extras(Observação). Categoria*, Conta*, Descrição*, Documento (? nº doc, NF, NSU), Fornecedor, Forma de pagamento (Banco Fiado, Boleto, Cartão crédito/débito, Convênio, Débito em conta, Dinheiro, Maquininha, PIX), Competência* (? data de aquisição; custo fixo = mês do serviço), Natureza* [Receita | Despesa], Vencimento*, "Pagar automaticamente no vencimento" (baixa automática), Valor* + link "Juros, multa e/ou desconto", Pago em, Se repete? [Não se repete | a cada mês | a cada ano | a cada semana | Informar período (parcelado)].
### Contas e cartões (/financeiro/conta/conta.php)
- Filtro tipo: Caixa | Conta corrente | Conta poupança | Cartão de crédito | Espécie | Investimento | Recebimentos; Ativo/Inativo. Tabela Nome | Tipo | Saldo | Status | Ações. Tipo "Recebimentos" = uma conta por forma de recebimento de cartão (Cielo Elo Crédito, ...). Saldos podem ficar negativos.
### Demonstrativo (DRE) (/financeiro/demonstrativo/demonstrativo.php)
- Toggle Regime de caixa | Regime de competência; período mês inicial/final (MM/AAAA); Categoria; Situação [Todas | Pagos/Recebidos | Em aberto]; Relatórios.
- Estrutura (plano de contas padrão): Resultado líquido > Resultado operacional > Receita líquida > Receita [Adiantamento de clientes, Descontos financeiros, Vendas em aberto, Vendas]; Despesas com mercadorias [Fornecedores de produtos]; Deduções de venda [Taxa de antecipação, Taxa de Pix, Taxa operadora cartão]; Impostos [Simples nacional]; Despesas operacionais > Administrativas [Aluguel, Material de escritório], Pessoal [Salários]... Colunas por mês + Total.

## COMISSIONAMENTO
### Comissões em aberto (/v2/comercial/comissao/fechamento)
- Link "Ver extratos"; filtro "Vendas baixadas até [Hoje]"; tabela Funcionário | valor até dd/mm (ex. Fábio Castro R$34,00 ...) | Total. Selecionar funcionário -> fechar extrato (programar pagamento).
- Painel "Configuração" (resumo das regras):
  - Funcionários comissionados (nº); por usuário "Recebe comissão: Sim/Não".
  - Transparência com sua equipe: "Seus funcionários PODEM acompanhar suas próprias comissões" (toggle).
  - Integração Financeira: "Toda vez que você fecha um extrato de comissão é gerado automaticamente um lançamento de contas a pagar".
  - Base de Cálculo: Líquido ou Bruto (valor líquido = após descontos).
  - Critério de pagamento: "apenas sobre as vendas baixadas" (alternativa: vendas lançadas).
  - Taxa da operadora: abate a taxa do cartão no cálculo (toggle).
  - Data de corte por funcionário; comissão % por produto/serviço (cadastro do item) e/ou por funcionário; devolução com crédito impacta comissão.
### Extratos (/v2/comercial/comissao/extratos): extratos fechados, recibo, reabrir, excluir.

## INTELIGÊNCIA
### Vendas (/v2/inteligencia/vendas)
- Filtro (laranja), "Mais ações" (ex.: criar Campanha SMS a partir do público), navegação de mês (< outubro de 2026 ▾ >). Abas Vendas | Clientes | Animais. Seções com ☆ (favoritar):
  - Evolução das vendas ao longo do tempo (gráfico linha; métrica: Venda líquida, Venda bruta, Ticket médio, Descontos, Qtd de vendas, Qtd de produtos; Dia/Semana/Mês).
  - Vendas por data (Data | Vendas (qtd + %) | Tkt. Médio | Bruto | Desconto (%) | Líquido; "Ver mais"; Total (N dias)).
  - Produtos e serviços mais vendidos (Nome | Qtd | Bruto | Desconto | Líquido).
  - Vendas por grupo de produtos e serviços (Percentual).
  - Marcas mais vendidas; Vendas por dia da semana; Pacotes mais vendidos; Vendas por turno; Kits mais vendidos; Tipo de item.
  - Filtros: Selecionar produto, Selecionar cliente.
### Produtividade (/v2/inteligencia/produtividade) e Minhas vendas (por funcionário).

## CONSULTAS > VACINAÇÃO (/consulta/vacina/vacina.php)
- Período (29/10 até 04/11 = próxima semana por padrão), Status [Aplicada | Programada | Vencida], Tipo [Vacinas | Vermífugos | Antiparasitário], Vacina; Relatórios. Abas: Resumo | Programação | Revisar cadastro (N) (animais com dados incompletos).
- Tabela Programação: Data | Cliente(código) | Animal(código) | Vacina | Status | Aplicação. Base para lembretes automáticos de vacina.

## CADASTROS CLÍNICOS
- TIPOS DE ATENDIMENTO (lista): Tipo (código) | Duração | Fluxo da agenda | Alertas | Áreas | Status. Relatórios, Adicionar.
  - Form aba GERAL: Nome*, Duração padrão* (5 min..12 h), Frequência recomendada [Não é recorrente, Semanal, Quinzenal, Mensal, Trimestral, Semestral, Anual] (sugere retorno/recorrência e alimenta "ciclo de vida"), Fluxo da agenda [Atendimento Clínico | Atendimento Banho e Tosa | Fluxo Simplificado], Status, Envio de mensagens automáticas [Sim/Não], Modelo de atendimento (editor TinyMCE + Etiquetas disponíveis).
  - Aba CAMPOS PERSONALIZADOS: "definidos de acordo com o fluxo e serão solicitados na mudança para os status": Agendado, Confirmado, Em espera, Cancelado, Em Atendimento, Animal Pronto -> cada um "+ Adicionar": Nome, Tipo do campo [Alfanumérico, Texto, Seleção única, Seleção Múltipla, Valor (decimal), Inteiro, Sim ou Não, Hora], Obrigatório/Opcional, Ativo/Inativo. (ex.: checklist do animal na entrada do banho e tosa, motivo do cancelamento).
- VACINAS (lista Nome | Tipo | Status; filtro tipo/status): form Nome*, Grupo* [Antiparasitário | Vacinas | Vermífugos], Status, Laboratórios (tags); protocolos por vacina (nº de doses, intervalo em dias, reforço anual) -> "Vacina - Protocolo"; vacinas encadeadas (ao terminar protocolo inicia outro); fundir vacinas (merge duplicadas); inativar.
- MODELOS DE DOCUMENTO: Nome*, Personalização (editor TinyMCE: Arquivo, Editar, Inserir, Visualizar, Formatar, Tabela, Ferramentas), Status. ETIQUETAS (merge tags):
  - Animal: @ANIMAL_NOME@ @ANIMAL_FICHA@ @ANIMAL_SEXO@ @ANIMAL_ESTERILIZACAO@ @ANIMAL_IDADE@ @ANIMAL_NASCIMENTO@ @ANIMAL_ANIVERSARIO@ @ANIMAL_MICROCHIP@ @ANIMAL_PELAGEM@ @ANIMAL_ESPECIE@ @ANIMAL_RACA@ @ANIMAL_PESO@ @ANIMAL_VACINAS_APLICADAS@ @ANIMAL_VACINAS_APLICADAS_RESUMO@ @ANIMAL_VACINAS_PROGRAMADAS@
  - Responsável: @RESPONSAVEL_NOME@ @RESPONSAVEL_PRIMEIRONOME@ @RESPONSAVEL_FICHA@ @RESPONSAVEL_ENDERECO@ @RESPONSAVEL_CIDADE@ @RESPONSAVEL_ESTADO@ @RESPONSAVEL_CEP@ @RESPONSAVEL_RG@ @RESPONSAVEL_CPF@ @RESPONSAVEL_DOCUMENTOS@ @RESPONSAVEL_TELEFONE@ @RESPONSAVEL_EMAIL@ @RESPONSAVEL_LISTA_ANIMAIS@
  - Clínica: @CLINICA_CIDADE@ @CLINICA_ESTADO@ @CLINICA_ENDERECO@ @CLINICA_NOME@ @CLINICA_RAZAOSOCIAL@ @CLINICA_EMAIL@ @CLINICA_CNPJ@ @CLINICA_SITE@ @CLINICA_TELEFONE@ @CLINICA_TELEFONE2@ @CLINICA_TELEFONE3@ @CLINICA_RESPONSAVEL@ @CLINICA_HORARIO@
  - Geral: @GERAL_DATA@ @GERAL_DATA_EXT@ @GERAL_ANO@
  - Usuários: @USUARIO_NOMEPUBLICO@ @USUARIO_TRATAMENTO@ @USUARIO_CELULAR@ @USUARIO_CRMV@ @USUARIO_MAPA@ @USUARIO_CARGO@ @USUARIO_ASSINATURA@ @USUARIO_NUMERACAO_SEQUENCIAL@ (numeração sequencial p/ receituário controlado)
  - Alertas/Mensagens: @MENSAGEM_DIAMES@ @MENSAGEM_DATA@ @MENSAGEM_VACINAS_EMAIL@ @MENSAGEM_VACINAS_SMS@ @MENSAGEM_EXAME_EMAIL@ @MENSAGEM_EXAME_SMS@ @MENSAGEM_AGENDA_EMAIL@ @MENSAGEM_AGENDA_SMS@ @MENSAGEM_CONTASAPAGAR_SMS@ @MENSAGEM_CONTASAPAGAR_EMAIL@
  - Modelos padrão: Atestado de aplicação de vacina, Atestado de óbito, Atestado de saúde, Atestado de vacinação (completo e resumido), Ficha resumida, Guia de trânsito, Receituário, Receituário de Controle Especial, Relatório detalhado de saldo, Solicitação de exame, TCLE, Termo de autorização para exames (adequados à Resolução CFMV 1321).

## MENSAGENS AUTOMÁTICAS (v3) — catálogo
- Para seus clientes: Boas vindas para novos animais; Boas vindas para novos clientes; Lembrete de agendamento; Lembrete de vacina e vermifugação; Parabéns pelo aniversário do animal; Parabéns pelo aniversário do cliente; Resultado de exames. 
- Para sua equipe: Agenda diária de atendimento; Lembrete de contas a pagar.
- Cada uma: Status Ativo/Inativo; canais SMS/E-mail/WhatsApp (cobrança por mensagem: WhatsApp R$0,50, SMS R$0,25, e-mail R$0,15 — créditos pré-pagos "Créditos e consumo"); onboarding antes de ativar.

## PERFIL DE ACESSO (/config/perfil/perfil.php)
- Lista Nome | Tipo (Modelo | Personalizado) | Ações (excluir, duplicar). Modelos: Administrador do sistema, Esteticista, Gestor da Clínica, Recepcionista, Veterinário (não editáveis, apenas duplicar).
- "Novo perfil": "A melhor forma de criar um novo perfil é a partir de um já existente" -> escolher modelo ou "Não usar modelo".
- Form: Nome*, árvore "Funcionalidades / Menus e recursos" (cada menu + ações granulares), "Painel de controle" (Widgets e Indicadores permitidos). PERMISSÕES GRANULARES:
  - Atendimento clínico: Alterar data e hora do evento; Arquivar e restaurar ficha de clientes e animais; Botão enviar mensagem; Ver histórico de mensagem; Classificação ABC do cliente; Configurações; Histórico de vendas para o animal; NPS > Histórico / Última resposta; Venda no atendimento > Alterar valor do produto / Conceder desconto; Relatório > Excel / PDF.
  - Clientes: arquivar/restaurar; mensagens; Classificação ABC; Configurações; NPS última resposta; Relatório Excel/PDF; Ver resumo de vendas do cliente.
  - Agenda: Adicionar lembrete; Configuração (Bloqueio p/ empresa, Bloqueio por profissional, Intervalo da agenda); Configuração de horários na tela; Confirmar escala na fila; Editar escalas; Enviar mensagem; Excluir agendamento; Habilitar todas as ações de atendimento; Relatório Completo/Resumido; Ver histórico de mensagens. Escala; Configuração.
  - Ponto de venda: Caixa > Abrir / Baixar vendas / Colocar em revisão / Despesa / Devolução de crédito / Devolução de venda / Fechar / Meus caixas / Permite devolução usando dinheiro do caixa / Reabrir / Resumo / Lista de recebimentos / Sangria / Suprimento / Transferência / Visualizar última venda; Converter venda em aberto em orçamento; Localizar venda; Meus caixas > Encerrar / Excluir baixa; Venda > Adicionar itens / Alterar Baixa / Alterar cliente/animal / Alterar Data e Hora / Alterar itens / Alterar valor do item / Envio de orçamento/venda / Conceder desconto / Desvincular nota fiscal / Excluir / Excluir itens / Informar data da 1ª parcela / Menu Fiscal / Visualizar e editar comissões; Ver últimas vendas pagas.
  - Movimentos de caixa: Reabertura do caixa. Consulta vendas: Menu Fiscal, Alterar data/hora, Alterar funcionário comissionado, Baixar, Conceder desconto, Dashboard, Editar baixa, Editar venda, Excluir baixa, Excluir venda, Exportar CSV, Filtro por período, Incluir venda, Data 1ª parcela, Navegação entre dias, Relatórios (Custo x venda bruta, Resumo, Por data, Detalhado, Totais por produto/serviço).
  - Pacotes vendidos: Permite cancelamento de pacote. Recebimentos: filtros, relatórios Detalhado/Excel/Resumido. Lista de preços; Ranking; Saldo dos clientes; Formas de recebimento; Modelo de orçamento; Modelo de demonstrativo; Configuração.
  - Comissionamento (Comissões em aberto, Extratos); Inteligência (Produtividade, Vendas); Consultas (Vacinação + Dashboard de vacinação, Aniversários, Log).
  - Cadastros: Espécies, Raças, Pelagens, Patologias, Tipos de atendimento, Vacinas, Exames, Atributos, Referências, Modelo de receita (+ Editar modelos de receita compartilhados), Origem dos clientes, Modelo de documento.
  - Internação: Animais internados (Venda na internação > Alterar valor / Conceder desconto), Mapa de Execução, Histórico (Adicionar ocorrências, Adicionar prescrição, Alta, Baixar prescrição, Cancelar, Edição, Enviar comunicado, Imprimir, Pesagem, Reabrir, Registro de óbito, Relatório médico, Remanejar box, Salvar modelo de prescrição), Parâmetros clínicos, Modelos de prescrição, Boxes.
  - Estoque: Produtos e Serviços (Ajuste de estoque, Define limite de desconto, Define controle/alteração de validade, Imprimir etiquetas), Compras (Editar, Excluir), Outras saídas, Análise de estoque, Inventário (Define controle de validade), Pedido de compra, Grupos, Marcas, Produtos recomendados.
  - Financeiro: Lançamentos, Conciliação de cartões, Contas a pagar, Demonstrativo, Fluxo de caixa, Contas e cartões, Categorias, Fornecedores, Formas de pagamento.
  - Configuração (Empresa, Usuários, Acesso externo, Perfil de Acesso); Fiscal (Notas de serviço, Notas de produto, Perfis Tributários); NFC-e (Caixa de saída, Perfis, Configuração); Site; Portal SimplesPet; Mensagens; NPS; Mapa do Sucesso; Treinamentos; Área do Cliente; Indique.
  - Painel: Widgets (Acesso > Últimos acessos; Agenda > Comunicados; Cliente > Animais por ano/mês, Aniversariantes, Ciclo de vida, Consultas por mês, Últimos animais, Últimos atendimentos, Vacinas; Financeiro > Contas a pagar, Fluxo de caixa, Lançamentos recentes/vencidos, Maiores despesas, Saldo diário, Saldos; Internação > Animais internados; Mensagens > Respostas SMS; Vendas > Estoque abaixo do mínimo, Venda líquida diária/mensal) e Indicadores (Espaço ocupado por arquivos, NPS, Saldo para mensagens, Média atendimento dia, Média espera dia, Débitos de clientes, Total de animais, Total de proprietários, Investimentos, Receitas/despesas/resultado, Saldo em conta, Descontos, Ticket médio, Venda Bruta, Venda líquida).
- Funcionalidade extra observada: "Classificação ABC do cliente" (curva ABC de clientes por faturamento).

## CONFIGURAÇÃO > EMPRESA (/config/clinica/clinica.php) — abas Geral | Endereço | Logomarca | Parâmetros | Responsáveis
- Geral: Tipo* (PF/PJ), Nome público* (?: aparece em relatórios/receitas/documentos), Sigla* (exibida no menu do usuário topo direito), CPF/CNPJ*, Nome completo/Razão social*, Inscrição Estadual, Inscrição municipal (só NFS-e), Registro no CRMV, Email comercial*, Telefones comerciais 1*/2/3, Site, Redes sociais, Horário de funcionamento.
- Endereço: CEP*, Endereço*, Número*, Complemento, Ponto de referência, Geolocalização, Bairro*, Cidade*, Estado*.
- Logomarca: upload (usada no cabeçalho de impressões e menu).
- PARÂMETROS: Fuso horário (lista BR + exterior); "Informação sobre idade do cliente?" [Somente aniversário | Data de nascimento]; "Arquivar ficha do cliente automaticamente após 5 anos sem comprar?" [Sim|Não]; BLOQUEIO DOS EVENTOS CLÍNICOS [Não bloquear | 1h | 2h | 6h | 8h | 12h | 1 dia | 2 | 3 | 7 | 14 | 21 | 30 dias após a inclusão] (prontuário fica imutável após o prazo — segurança jurídica/CFMV).
- Responsáveis: Administrador do sistema (usuário), Responsável financeiro: Usuário*, E-mails p/ boleto e nota fiscal*, Celular p/ contato financeiro*.

## VENDAS > CONFIGURAÇÃO (/venda/configuracao/configuracao.php) — REGRAS DE NEGÓCIO
- Fechar caixa diariamente: caixas abertos são fechados automaticamente às 23:59h. [Sim/Não]
- Unificar vendas do dia, por cliente: une automaticamente as vendas do cliente feitas num mesmo dia no PDV e no consultório.
- Obrigar usuário no item da venda (comissão).
- Permite vender sem estoque.
- Obrigar preenchimento do NSU (conciliação de cartões).
- Controle sobre descontos: limite geral da empresa? "Por padrão não será possível conceder descontos, a não ser que os usuários ou os produtos tenham um limite específico."
- Devolução: "Configurar devolução" (devolução de venda e devolução de crédito).
- Orçamentos: Validade padrão (dias); Obrigar cliente nos orçamentos; Título [Orçamento | Plano de tratamento] ("Plano de tratamento" traz senso de urgência para clínicas).
- Salvar | Log.

## OUTROS
- Acesso externo (/config/restricao): [Liberado | Controlado] — Liberado: "Todos os usuários podem acessar de qualquer lugar"; Controlado: restringe por IP/rede da clínica por usuário ("Bloqueio por acesso externo").
- Módulos não ativos (NPS, Portal SimplesPet...) redirecionam para /sucesso/index.php?servico=NPS -> modal "Erro! Nenhum plano foi contratado. Você será redirecionado." + bot Intercom "VetLover Virtual" oferecendo Módulo Fiscal / Internação / Mensagens.
- Mapa do Sucesso: "Índice de Utilização SimplesVet %", Plano contratado, Usuários ativos, Saldo para envio de mensagem (R$ 1,00 de cortesia no trial), cards de serviços adicionais (gamificação de adoção).
- Compras (/cadastro/compra): filtro Período, Fornecedor; "+ Adicionar" (manual), "Importar XML" (NF-e do fornecedor: cria produtos/fornecedor, entra estoque e custo); após salvar pergunta "Deseja imprimir agora as etiquetas de preço para os produtos dessa nota?".
- Outras saídas de estoque: consumo interno, perda de validade, avaria e doação.
- Saldo dos clientes: lista clientes com débito e/ou crédito (conta corrente do cliente).
- ANÁLISE DE ESTOQUE (funcionalidade gratuita) — wizard "Parâmetros de compra 1/2": Frequência de compra* (dias; ex. semanal=7), Tempo médio para elaborar o pedido* (dias), Tempo médio de entrega* (dias; pode sobrescrever por fornecedor). "Após concluir, o estoque mínimo e o máximo passam a ser calculados automaticamente e não poderão ser editados." Classifica produtos em Repor / Excesso / Parado / Novo e sugere compra (gera Pedido de compra).
