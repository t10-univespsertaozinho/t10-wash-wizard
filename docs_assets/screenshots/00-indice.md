# Catálogo de capturas — Wash Wizard

Esta pasta é **gerada**, não editada à mão. As 23 imagens abaixo saem de
`npm run screenshots` (ver `scripts/capture-screenshots.mjs`).

## Por que estas imagens não têm dado real

- A captura é da **viewport** do Chromium headless, não da janela do navegador:
  não existe barra de abas, favoritos, endereço ou barra de tarefas na imagem.
- O banco usado é o de `scripts/demo-data.mjs` — 24 clientes, 31 veículos e 81
  lavagens **fictícios**, gravados em `~/.cache/wash-wizard-demo/wash_wizard.db`
  (fora do repositório). O `wash_wizard.db` de desenvolvimento nunca é aberto.
- Os dados são **pseudonimizados na origem**, não borrados depois: cliente é
  `Cliente 001`, telefone usa **DDD 00** (não atribuído pela ANATEL, logo não
  colide com linha real), placa é `•••••01` e data de nascimento é nula.
- O login é feito por API e o JWT é injetado no `localStorage` antes do primeiro
  paint: nenhum formulário de senha, nenhum autofill de credencial.
- As imagens passam por `convert -strip` (sem EXIF/metadados) e cada tela tem o
  texto renderizado auditado contra telefone, placa, CPF/CNPJ/CEP, e-mail,
  `localhost`, caminhos absolutos, `NaN` e `undefined` — incluindo `value` de
  campos e `placeholder`, que o `innerText` não enxerga.
- Um **portão de privacidade** consulta o SQLite antes do build e aborta a
  captura se nome, telefone, nascimento, placa, observação ou usuário não
  estiverem anonimizados.

O raciocínio completo — categoria de cada dado, achados, base legal e risco
residual — está em [`AVALIACAO-LGPD.md`](./AVALIACAO-LGPD.md).

Para refazer tudo:

```bash
npm run screenshots              # banco demo + build + 23 capturas + auditoria
npm run screenshots -- --only 07 # só as telas de uma pasta (07-estoque)
npm run screenshots -- --no-build --keep-db
```

A marca **Lava Rápido Maquininha** aparece nas telas porque é o cenário real de
validação em campo do projeto (Projeto Integrador UNIVESP) — os dados exibidos
seguem sintéticos.

## 01 — Autenticação

| Arquivo | Rota | O que mostra |
|---|---|---|
| `01-login/login.png` | `/login` | Autenticação com JWT e retorno de perfil por papel (admin/operador). |

## 02 — Dashboard

| Arquivo | Rota | O que mostra |
|---|---|---|
| `02-dashboard/dashboard-visao-geral.png` | `/` | KPIs financeiros da semana, comparativo com o período anterior e série diária de 7 dias. |
| `02-dashboard/dashboard-bi-pilares.png` | `/` | Fluxo diário, alerta de compras com Runway de estoque e fila de atendimento do pátio. |
| `02-dashboard/dashboard-tema-escuro.png` | `/` | Mesmo painel no tema escuro (preferência persistida em `localStorage`). |

## 03 — Lavagens

| Arquivo | Rota | O que mostra |
|---|---|---|
| `03-lavagens/lavagens-fila.png` | `/lavagens` | Todas as lavagens com filtro por status e ações de iniciar/concluir/cancelar. |
| `03-lavagens/lavagens-concluidas.png` | `/lavagens` | Filtro de lavagens concluídas, com forma de pagamento e valor por atendimento. |

## 04 — Clientes

| Arquivo | Rota | O que mostra |
|---|---|---|
| `04-clientes/clientes-listagem.png` | `/clientes` | Listagem com busca por nome ou telefone, contagem de veículos e de lavagens. |
| `04-clientes/clientes-detalhe.png` | `/clientes/cli-001` | Ficha do cliente: veículos vinculados e histórico completo de lavagens. |
| `04-clientes/clientes-edicao.png` | `/clientes/cli-001/editar` | Edição cadastral com validação de telefone e data de nascimento. |

## 05 — Veículos

| Arquivo | Rota | O que mostra |
|---|---|---|
| `05-veiculos/veiculos-listagem.png` | `/veiculos` | Frota cadastrada, com busca por modelo, placa ou cliente. |
| `05-veiculos/veiculos-formulario.png` | `/veiculos` | Modal de cadastro de veículo vinculado a um cliente, com placa validada. |

## 06 — Serviços

| Arquivo | Rota | O que mostra |
|---|---|---|
| `06-servicos/tipos-lavagem.png` | `/tipos-lavagem` | Catálogo de serviços com criação e edição por linha, usados no faturamento. |

## 07 — Estoque

| Arquivo | Rota | O que mostra |
|---|---|---|
| `07-estoque/estoque-critico.png` | `/estoque` | Estoque com alerta de itens zerados/baixos e status por produto. |
| `07-estoque/novo-produto.png` | `/novo-produto` | Cadastro de insumo com quantidade mínima, categoria e unidade. |

## 08 — Movimentações

| Arquivo | Rota | O que mostra |
|---|---|---|
| `08-movimentacao/movimentacao-estoque.png` | `/movimentacao` | Entradas e saídas de insumo: base do consumo diário usado no Runway. |

## 09 — Análise & Relatórios (admin)

| Arquivo | Rota | O que mostra |
|---|---|---|
| `09-analise/analise-mix-servicos.png` | `/analise` | Mix de serviços dos últimos 30 dias: volume x rentabilidade e leitura de negócio. |
| `09-analise/analise-retencao.png` | `/analise` | Radar de clientes ausentes há mais de 30 dias com reengajamento por WhatsApp. |

## 10 — Configurações (admin)

| Arquivo | Rota | O que mostra |
|---|---|---|
| `10-configuracoes/configuracoes-backup.png` | `/configuracoes` | Administração do banco SQLite com exportação/importação de backup em CSV. |

## 11 — Modais

| Arquivo | Rota | O que mostra |
|---|---|---|
| `11-modais/modal-nova-lavagem.png` | `/lavagens` | Modal acessível de registro de lavagem, reutilizado no dashboard e na listagem. |
| `11-modais/modal-novo-cliente.png` | `/clientes` | Modal de cadastro de cliente aberto por cima da listagem. |

## 12 — Visão do operador (RBAC)

| Arquivo | Rota | O que mostra |
|---|---|---|
| `12-operador/visao-operador-rbac.png` | `/` | Visão do operador: menu sem as áreas administrativas (RBAC aplicado na rota e na API). |

## 13 — Mobile

| Arquivo | Rota | O que mostra |
|---|---|---|
| `13-mobile/mobile-dashboard.png` | `/` | Dashboard em viewport de celular (390x844), com gráficos responsivos. |
| `13-mobile/mobile-menu-gaveta.png` | `/` | Gaveta de navegação aberta no mobile: fecha com `Esc` e devolve o foco ao botão. |

---

Todas as capturas de desktop são 1440×900 (viewport 1440×900 em 2x, reduzida a
1440 px de largura na otimização); as de mobile são 780×1688.
