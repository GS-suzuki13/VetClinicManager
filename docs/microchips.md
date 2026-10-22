# Microchips no VetClinic

Referência técnica e regulatória que embasa o módulo de microchips.

## Como o microchip funciona

- Transponder RFID **passivo**: sem bateria e sem GPS. Fica inerte até ser energizado pelo campo do leitor, quando
  transmite apenas o seu número. Não rastreia localização.
- Tamanho típico de um grão de arroz (≈ 2 × 12 mm, versões "mini" ≈ 1,4 × 8 mm), encapsulado em vidro biocompatível.
- **O chip guarda só o número.** Tutor, contato, vacinas e histórico ficam em bancos de dados. Sem cadastro em uma
  base consultável, o chip não ajuda a devolver um animal perdido.

## Padrões e formatos de código

| Formato | Frequência | Código | Observação |
|---|---|---|---|
| ISO 11784/11785 FDX-B (ou HDX) | 134,2 kHz | 15 dígitos | Padrão internacional; exigido por UE e outros destinos |
| FDX-A (legado) | 125 kHz | 10 hexadecimais | Não ISO |
| AVID (legado) | 125 kHz | 9 dígitos | Não ISO; alguns são criptografados |

Nos 15 dígitos ISO, os 3 primeiros indicam:
- **900–998**: código do fabricante (ICAR), ex.: 977 Avid, 981 Datamars, 982 Allflex, 985 Destron Fearing.
- **< 900**: código do país (ISO 3166 numérico), ex.: **076 = Brasil**. Só usado onde há base central que emite números.
- **999**: reservado a transponders de teste.

Leitores "universais" leem FDX-B, HDX e FDX-A; formatos legados podem não ser lidos por leitores ISO simples.

## Onde os dados ficam (Brasil)

- **SinPatinhas** (Lei 15.046/2024, MMA): cadastro nacional gratuito de cães e gatos via Gov.br. Voluntário para a
  maioria dos tutores; obrigatório em ações com recursos federais (castração/microchipagem). Aceita o número do chip.
- Bancos dos fabricantes e cadastros municipais (ex.: programas de identificação de prefeituras).
- **Viagem internacional**: muitos destinos (ex.: União Europeia) exigem chip ISO implantado **antes** da vacina
  antirrábica. Conferir sempre as regras atuais no MAPA (gov.br/agricultura) e do país de destino.

## Boas práticas clínicas (WSAVA / fabricantes)

1. Ler o animal **antes** de implantar (pode já ter chip) e conferir o número do chip na embalagem.
2. Implantar no subcutâneo da **linha média dorsal, entre as escápulas** (padrão para cães e gatos fora da Europa;
   na Europa é comum o lado esquerdo do pescoço).
3. Ler **após** implantar para confirmar funcionamento e número.
4. Registrar no prontuário e orientar o tutor a cadastrar o número em uma base (SinPatinhas).
5. Ler o chip em consultas de rotina. Se não ler no local padrão, varrer em "S" o corpo todo (o chip pode migrar),
   girando o leitor 90°, longe de mesas metálicas.

## O que o sistema implementa

- **Cadastro** com validação/normalização do código e identificação de formato e fabricante/país.
- **Leitura**: campo que aceita leitores USB/Bluetooth (modo teclado + Enter). Chip conhecido abre o histórico;
  desconhecido oferece cadastro e busca em outras clínicas.
- **Histórico imutável** (`microchip_events`): cadastro, vínculo/desvínculo de animal, troca de status, registro
  externo e correção de código gravados automaticamente no banco; leituras e anotações manuais. Ninguém edita ou apaga
  eventos; o autor é sempre o usuário autenticado.
- **Regras**: código único por clínica, no máximo um chip ativo por animal, vínculo só com animais da própria clínica,
  exclusão restrita a proprietário/administrador (o normal é alterar o status).
- **Busca entre clínicas** (animal encontrado): opt-in por chip, com consentimento do tutor. Revela apenas o **nome da
  clínica**; nenhum dado de tutor ou animal sai do tenant (LGPD).
- **Pendências** visíveis: chips ativos sem registro externo, chips sem animal, chips com defeito.

Testes: `tests/isolation.test.mjs` (seção "Microchips").

## Fontes

- WSAVA — Microchip Identification Guidelines: https://wsava.org/Global-Guidelines/Microchip-Identification-Guidelines/
- WSAVA — Microchip FAQs: https://wsava.org/wp-content/uploads/2020/01/Microchip-FAQs_0.pdf
- ISO 11784/11785: https://en.wikipedia.org/wiki/ISO_11784_and_ISO_11785
- ASPCA — diagrama de leitura: https://www.aspcapro.org/sites/default/files/2024-04/microchip_scanning_diagram.pdf
- SinPatinhas: https://sbtnews.sbt.com.br/noticia/brasil/sinpatinhas-saiba-como-funciona-e-como-fazer-um-rg-para-o-seu-pet
- MAPA — trânsito internacional: https://www.gov.br/agricultura/pt-br/assuntos/vigilancia-agropecuaria/animais-estimacao
