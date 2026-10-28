# 🌊 Wash Wizard 
**Sistema Fullstack de Gestão & Business Intelligence (BI) para Centros de Estética Automotiva**  
*Versão Acadêmica & Empresarial (PostgreSQL / Supabase / Analytics)*

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Academic-red.svg)](#)

---

O **Wash Wizard** é uma plataforma *fullstack* profissional desenvolvida para transformar a gestão operacional e estratégica de centros de estética automotiva, lava-jatos e oficinas de detalhamento (*car detailing*). A solução combina o controle de fluxo de pátio em tempo real com um **Módulo de Data Analytics & BI Prático**, traduzindo dados transacionais brutos em indicadores acionáveis para tomada de decisão rápida e assertiva.

Projetada com uma arquitetura desacoplada e resiliente, a aplicação opera com Node.js sobre **PostgreSQL gerenciado no Supabase**, garantindo integridade relacional, backup gerenciado pelo provedor e portabilidade completa via exportação/importação modular em CSV.

📄 **[Acesse a Documentação Gráfica Completa (docs.html)](./docs.html)**

---

## 📑 Índice

1. [Visão Geral e Funcionalidades](#-visão-geral-e-funcionalidades)
2. [Módulo de Data Analytics & BI Prático](#-módulo-de-data-analytics--bi-prático)
3. [Estudo de Caso & Validação em Campo](#-estudo-de-caso--validação-em-campo)
4. [Arquitetura e Desempenho Técnico](#-arquitetura-e-desempenho-técnico)
5. [Stack Tecnológico](#-stack-tecnológico)
6. [Estrutura do Repositório](#-estrutura-do-repositório)
7. [Guia de Inicialização](#-guia-de-inicialização)
8. [Gerenciamento de Banco de Dados e Backups](#-gerenciamento-de-banco-de-dados-e-backups)
9. [Segurança e Autenticação](#-segurança-e-autenticação)
10. [Próximos Passos](#-próximos-passos)
11. [Autores e Licença](#-autores-e-licença)

---

## 🚀 Visão Geral e Funcionalidades

O sistema provê o controle ponta-a-ponta do fluxo operacional e estratégico:

- **Gestão de Clientes e Veículos (com Data de Nascimento):** Cadastro unificado de proprietários e múltiplos veículos com integridade relacional estrita (deleção em cascata e histórico unificado). Inclui suporte ao campo `data_nascimento` (`YYYY-MM-DD`) para identificação de aniversariantes e campanhas promocionais de fidelização, persistido no PostgreSQL e integrado às rotinas de importação/exportação CSV.
- **Controle de Lavagens (Workflow de Pátio):** Acompanhamento de status em tempo real (`pendente`, `em_progresso`, `concluida`, `cancelada`) com fila operacional rápida.
- **Cadastros Ágeis em Modais Acessíveis:** Os fluxos operacionais de *Nova Lavagem*, *Novo Cliente*, *Novo Veículo*, *Novo Serviço* e *Movimentação de Estoque* abrem em *overlays* reutilizáveis e centralizados via `ModalProvider` — com foco automático, fechamento por `Esc`/clique fora e suporte pleno a tecnologias assistivas (WCAG 2.4.3, 1.3.1).
- **Gestão de Estoque e Suprimentos:** Controle de saldo, ponto de pedido (`estoque_minimo`) e histórico de movimentações (entradas e saídas com transações atômicas), acessível diretamente pelo modal de movimentação rápida ou pela página de estoque.
- **Business Intelligence (BI):** **Dashboard** operacional dia a dia (admin e operador) + área exclusiva **Análise & Relatórios** (`/analise`, perfil admin) com os 4 pilares de decisão em KPIs legíveis e séries temporais.
- **Acessibilidade Plena (WCAG 2.1 AA / W3C):** Contraste de cores validado em temas claro e escuro, paleta Okabe-Ito inclusiva para daltônicos, *skip-link*, navegação completa por teclado, associação explícita de rótulos (`<label htmlFor>` para `<input id>`) em todos os formulários e gráficos espelhados em tabelas semânticas (`ChartDataTable`) para leitores de tela.
- **Qualidade Automatizada & CI:** Suíte de testes frontend (**91 casos**, Vitest + Testing Library) com **gate de cobertura calibrado** (`branches`, `functions`, `lines`, `statements`) e testes de integração backend (**43 casos**, Vitest + Supertest), orquestrados via **GitHub Actions** com auditoria de segurança rigorosa.
- **Sistema de Backup Resiliente:** Importação e exportação de todas as entidades relacionais via CSV com allowlist de colunas (incluindo `data_nascimento`) e integridade referencial.
- **RBAC (Role-Based Access Control):** Controle estrito de acesso entre perfis Operador e Administrador, validado no backend via JSON Web Token (JWT).

---

## 📊 Módulo de Data Analytics & BI Prático

Diferente de dashboards genéricos com métricas estáticas ou jargões complexos de ciência de dados, o Wash Wizard separa a **visão operacional** do dia (Dashboard em `/`, perfis admin e operador) da **inteligência do negócio** (página **Análise & Relatórios** em `/analise`, restrita ao admin). O BI organiza o painel gerencial em **4 pilares práticos de decisão**:

1. **Saúde Financeira da Operação:**
   - Faturamento semanal líquido de atendimentos finalizados.
   - Volume total de lavagens concluídas nos últimos 7 dias.
   - **Ticket Médio** por veículo atendido ($\text{Receita} \div \text{Qtd Lavagens Concluídas}$).
   - **Comparativo Percentual Temporal:** Indicador dinâmico de crescimento ou retração contra o período anterior (semana atual vs. semana anterior).
2. **Análise de Mix de Serviços (Produtividade vs. Rentabilidade):**
   - Comparativo visual entre **Volume de Atendimentos** (% da fila) e **Faturamento Gerado** (% da receita total).
   - Identificação imediata do *Serviço Líder de Fila* (mais procurado) versus o *Campeão de Lucro* (maior margem para estratégias de *upsell*).
3. **Gestão Preditiva de Suprimentos (Runway de Estoque):**
   - Monitoramento contínuo de insumos que cruzaram o ponto de pedido (`quantidade <= estoque_minimo`).
   - Cálculo dinâmico do consumo médio diário com base no histórico real de saídas (`movimentacoes`).
   - Projeção de esgotamento em dias (*Runway*), classificando itens em alertas intuitivos: `🔴 Zerado! Repor já`, `🔴 Acaba em ~X dias`, `🟡 Acaba em ~X dias` e `⚪ Abaixo do mínimo`.
4. **Retenção e Recorrência de Clientes:**
   - **Índice de Fidelização:** Percentual de clientes que já retornaram duas ou mais vezes à oficina.
   - **Radar de Clientes Ausentes (> 30 dias):** Identificação dos clientes habituais que não comparecem há mais de um mês.
   - **Reengajamento em 1 Clique (WhatsApp):** Disparo de link direto para a API do WhatsApp (`wa.me`) com mensagem amigável pré-formatada para resgatar o cliente.

---

## 🔬 Estudo de Caso & Validação em Campo

Embora o Wash Wizard tenha sido concebido como uma arquitetura genérica e configurável para qualquer estabelecimento de estética automotiva, sua validação prática foi conduzida em ambiente real de produção no **Lava Rápido Maquininha**, sob gestão do proprietário **Sr. Reinaldo**.

Essa validação em campo constitui o núcleo prático do **Projeto Integrador do curso de Engenharia de Computação da UNIVESP (Polo Sertãozinho/SP)**. Os testes operacionais com o proprietário demonstraram a importância de traduzir queries analíticas complexas em ações imediatas de negócio (ex: alerta de recompra de shampoo antes do término do estoque e reativação ativa de clientes via mensagem instantânea).

---

## 📸 Telas da Aplicação (Demonstração)

Capturas reais da aplicação em execução, organizadas por módulo. O catálogo
completo (com a rota de cada tela) está em
[`docs_assets/screenshots/00-indice.md`](./docs_assets/screenshots/00-indice.md).

> **Dados fictícios e pseudonimizados.** As imagens são geradas por
> `npm run screenshots` contra um banco de demonstração (`scripts/demo-data.mjs`)
> — 24 clientes, 31 veículos e 81 lavagens inventados, gravados fora do
> repositório. Nenhum dado de cliente real aparece nas capturas: cliente é
> `Cliente 001`, telefone usa DDD 00 (não atribuído pela ANATEL), placa é
> `•••••01` e não há data de nascimento. A marca *Lava Rápido Maquininha* é
> mantida por ser o cenário de validação em campo do projeto.
> A avaliação técnica de LGPD das imagens (achados, base legal e risco residual)
> está em
> [`docs_assets/screenshots/AVALIACAO-LGPD.md`](./docs_assets/screenshots/AVALIACAO-LGPD.md).

### Autenticação
Acesso com JWT; o menu e as rotas mudam conforme o papel (`admin` / `operador`).
<div align="center">
  <img src="./docs_assets/screenshots/01-login/login.png" alt="Tela de login do Wash Wizard" width="72%" />
</div>

### Dashboard
KPIs da semana com comparativo ao período anterior, série de 7 dias e os pilares
de BI (Runway de estoque e fila do pátio).
<div align="center">
  <img src="./docs_assets/screenshots/02-dashboard/dashboard-visao-geral.png" alt="Dashboard com KPIs financeiros e fluxo diário" width="100%" />
</div>
<div align="center">
  <img src="./docs_assets/screenshots/02-dashboard/dashboard-bi-pilares.png" alt="Alerta de compras e fila de atendimento do pátio" width="49%" />
  <img src="./docs_assets/screenshots/02-dashboard/dashboard-tema-escuro.png" alt="Dashboard no tema escuro" width="49%" />
</div>

### Lavagens
Fila operacional com filtro por status e ações de iniciar, concluir e cancelar.
<div align="center">
  <img src="./docs_assets/screenshots/03-lavagens/lavagens-fila.png" alt="Listagem de lavagens" width="49%" />
  <img src="./docs_assets/screenshots/03-lavagens/lavagens-concluidas.png" alt="Lavagens concluídas com forma de pagamento" width="49%" />
</div>

### Clientes
Listagem com busca, ficha detalhada com veículos e histórico, e edição cadastral.
<div align="center">
  <img src="./docs_assets/screenshots/04-clientes/clientes-listagem.png" alt="Listagem de clientes" width="49%" />
  <img src="./docs_assets/screenshots/04-clientes/clientes-detalhe.png" alt="Ficha do cliente com veículos e histórico" width="49%" />
</div>
<div align="center">
  <img src="./docs_assets/screenshots/04-clientes/clientes-edicao.png" alt="Edição de cliente" width="72%" />
</div>

### Veículos
Frota vinculada aos clientes, com busca por modelo, placa ou nome.
<div align="center">
  <img src="./docs_assets/screenshots/05-veiculos/veiculos-listagem.png" alt="Listagem de veículos" width="49%" />
  <img src="./docs_assets/screenshots/05-veiculos/veiculos-formulario.png" alt="Formulário de cadastro de veículo" width="49%" />
</div>

### Serviços e Estoque
Catálogo de serviços que alimenta o faturamento e estoque com alerta de itens
zerados/baixos (a base do cálculo de Runway).
<div align="center">
  <img src="./docs_assets/screenshots/06-servicos/tipos-lavagem.png" alt="Cadastro de tipos de lavagem" width="49%" />
  <img src="./docs_assets/screenshots/07-estoque/estoque-critico.png" alt="Estoque com alerta de itens críticos" width="49%" />
</div>
<div align="center">
  <img src="./docs_assets/screenshots/07-estoque/novo-produto.png" alt="Cadastro de novo insumo" width="49%" />
  <img src="./docs_assets/screenshots/08-movimentacao/movimentacao-estoque.png" alt="Movimentações de entrada e saída de estoque" width="49%" />
</div>

### Análise & Relatórios
Mix de serviços (volume × rentabilidade) e radar de clientes ausentes com
reengajamento por WhatsApp.
<div align="center">
  <img src="./docs_assets/screenshots/09-analise/analise-mix-servicos.png" alt="Mix de serviços dos últimos 30 dias" width="49%" />
  <img src="./docs_assets/screenshots/09-analise/analise-retencao.png" alt="Radar de clientes ausentes com link para WhatsApp" width="49%" />
</div>

### Configurações e Modais
Backup/restauração em CSV e os modais globais de cadastro (mesmo componente
acessível reutilizado em várias telas).
<div align="center">
  <img src="./docs_assets/screenshots/10-configuracoes/configuracoes-backup.png" alt="Configurações de backup do banco" width="100%" />
</div>
<div align="center">
  <img src="./docs_assets/screenshots/11-modais/modal-nova-lavagem.png" alt="Modal de registro de lavagem" width="49%" />
  <img src="./docs_assets/screenshots/11-modais/modal-novo-cliente.png" alt="Modal de cadastro de cliente" width="49%" />
</div>

### Visão do operador (RBAC)
O mesmo sistema com o menu reduzido: as áreas administrativas somem da navegação
e são barradas também na API.
<div align="center">
  <img src="./docs_assets/screenshots/12-operador/visao-operador-rbac.png" alt="Dashboard na visão do operador, sem itens administrativos no menu" width="72%" />
</div>

### Mobile
Layout responsivo em viewport de celular (390×844), com gaveta de navegação
operável por teclado.
<div align="center">
  <img src="./docs_assets/screenshots/13-mobile/mobile-dashboard.png" alt="Dashboard em tela de celular" width="32%" />
  <img src="./docs_assets/screenshots/13-mobile/mobile-menu-gaveta.png" alt="Gaveta de navegação aberta no celular" width="32%" />
</div>

#### Como regenerar as capturas

```bash
npm run screenshots              # banco demo + build + capturas + auditoria
npm run screenshots -- --only 07 # apenas uma pasta (ex.: 07-estoque)
npm run screenshots -- --no-build --keep-db
```

O pipeline usa Chromium headless, captura só a *viewport* (sem chrome do
navegador), injeta o JWT via `localStorage` (sem formulário de senha), remove
metadados com `convert -strip` e audita o texto de cada tela contra telefone,
placa, e-mail e caminhos locais.

---

## 📐 Arquitetura e Desempenho Técnico

A aplicação utiliza o padrão **Client-Server** desacoplado em um repositório *Monorepo*, orquestrado por scripts padronizados de desenvolvimento e produção.

```text
[Frontend: React 18 SPA] <---(REST API JSON / Porta 3001)---> [Backend: Node.js + Express]
         |                                                            |
(Vite Dev Server: Porta 8080)                     (PostgreSQL / Supabase — Pool de conexões)
```

### Evolução Arquitetural de BI (Otimização Server-Side):
Nas iterações iniciais, o cálculo de métricas era realizado no navegador do cliente através de filtros em memória (`useMemo`) após download de todas as tabelas transacionais brutas. Na evolução analítica atual, implementou-se a **centralização analítica via SQL**:
- **Descentralização e Eficiência:** O endpoint analítico `GET /api/dashboard/stats` consolida todos os 4 pilares de negócio diretamente no PostgreSQL através de consultas otimizadas com *Common Table Expressions* (CTEs), funções de data (`NOW() - INTERVAL`, `to_char`, `EXTRACT(EPOCH ...)`) e agregações relacionais indexadas.
- **Payload Ultraleve:** O tráfego de rede para carregar o dashboard foi reduzido de centenas de kilobytes (múltiplas tabelas completas) para um **JSON agregado de apenas ~1.2 KB**.
- **Latência de Consulta:** Tempo de resposta da API analítica **inferior a 30 ms**, assegurando carregamento instantâneo mesmo em hardware modesto ou conexões móveis no pátio.

### Decisões Arquiteturais Complementares:
- **Code-Splitting & Lazy Loading:** Roteamento com `React.lazy()` e `Suspense`, garantindo que o bundle inicial do frontend carregue em frações de segundo.
- **Cadastros via Modais (Contexto Global):** Os fluxos de *Nova Lavagem*, *Novo Cliente*, *Novo Veículo*, *Novo Serviço* e *Movimentação de Estoque* abrem em `Dialog` acessíveis gerenciados pelo `ModalProvider`, reutilizados de qualquer tela sem duplicação de UI.
- **Acessibilidade Completa (WCAG 2.1 AA / W3C):** Tema claro/escuro com contraste verificado, paleta Okabe-Ito (daltônicos), *skip-link* para o conteúdo, gaveta de navegação operável apenas por teclado (foco, `Esc` e retorno de foco), formulários com associação explícita de `<label htmlFor>` para `<input id>` e gráficos Recharts espelhados em tabelas semânticas (`ChartDataTable`) para leitores de tela.
- **Testes Automatizados com Gate de Cobertura:** Suíte Vitest + React Testing Library com relatório `v8` e limiares calibrados em dois níveis — uma **catraca global** balanceada e **limiares altos (≥90%)** por camada crítica (`src/utils`, `src/services`, `AuthContext`, `ErrorBoundary`). Queda de cobertura falha o pipeline.
- **Pipeline CI & Segurança:** O job de frontend roda *lint* (ESLint sem erros a11y), suíte com cobertura e build de produção; o job de backend sobe um PostgreSQL 16 descartável, aplica schema/migrations, roda os testes de integração (43 testes Vitest + Supertest sobre o Express real) e um *healthcheck* de boot, além da auditoria de dependências (`npm audit --audit-level=high`).
- **Roteamento Protegido:** Validação de sessão ativa via JWT tanto no cliente quanto em cada camada de middleware do servidor.

---

## 💻 Stack Tecnológico

### Frontend
- **React 18** (TypeScript, Componentização e Hooks Avançados)
- **Vite** (Build Tool de alta performance e HMR ultrarrápido)
- **Tailwind CSS** & **shadcn/ui** (Design System modular e estilização utility-first)
- **Radix UI** (primitivos acessíveis de `Dialog`/overlay usados nos modais de cadastro)
- **Recharts** (Visualização Gráfica de Dados com paleta Okabe-Ito e A11y)
- **Lucide React** (Iconografia semântica e consistente)
- **Vitest + React Testing Library** (suíte de testes com 91 casos e gate de cobertura `v8`)

### Backend
- **Node.js, Express** (Servidor HTTP RESTful, Middlewares de Autenticação e Roteamento)
- **PostgreSQL 16 / Supabase (Queries Analíticas com CTEs)** (Banco de Dados Relacional Gerenciado, com Pool de conexões via `pg`)
- **JSON Web Token (JWT) & bcryptjs** (Autenticação Stateless, RBAC e Criptografia segura)
- **Multer & CSV-Parse** (Processamento e ETL de arquivos de backup com validação de cabeçalhos)

### Qualidade e CI
- **Frontend (job `frontend` do `ci.yml`):** `lint` (ESLint com regras a11y W3C estritas), `test:coverage` (91 testes + gate de cobertura calibrado) e `build` de produção — o merge falha se a cobertura cair abaixo dos limiares de `frontend/vitest.config.ts`.
- **Backend (job `backend`):** serviço `postgres:16`, aplicação do schema/migrations, 43 testes de integração do app Express real em banco descartável, auditoria estrita de dependências e validação de boot com credenciais inválidas (*healthcheck*).

---

## 📁 Estrutura do Repositório

```bash
wash-wizard/
├── frontend/               # Single Page Application (Client-Side)
│   ├── src/
│   │   ├── components/     # UI components (shadcn/ui), modais acessíveis e visuais
│   │   ├── contexts/       # Contextos globais (Auth, App/dados, Modais de cadastro)
│   │   ├── hooks/          # Hooks reutilizáveis (máscaras, tema, estatísticas)
│   │   ├── pages/          # Rotas principais (Lazy loaded)
│   │   ├── services/       # Módulos de conexão com a API
│   │   └── test/           # Suíte automatizada (Vitest + Testing Library)
│   ├── vite.config.ts      # Configurações do empacotador
│   ├── vitest.config.ts    # Configuração de testes e gate de cobertura (catraca + por camada)
│   └── package.json        
├── backend/                # RESTful API (Server-Side)
│   ├── server.js           # Ponto de entrada, Middlewares e Rotas
│   ├── db.js               # Pool PostgreSQL (pg), parsers e transações
│   ├── config.js           # Segredo JWT e configurações de auth
│   ├── middleware/auth.js  # requireAuth / requireAdmin
│   ├── schema.postgres.sql # DDL e Constraints (versionado no repo — ver nota abaixo)
│   ├── migrations/         # Migrações aditivas aplicadas em bancos existentes
│   ├── test/               # Testes de integração (Vitest + Supertest)
│   └── package.json        
├── backups/                # Diretório automatizado para exports CSV
├── docs.html               # Documentação interativa
├── ROADMAP.md              # Planejamento da próxima fase (Data Science / Analytics)
├── SECURITY.md             # Matriz de RBAC, autenticação e proteções da API
├── .github/workflows/ci.yml # CI: lint + cobertura + build (frontend); testes + boot (backend)
└── package.json            # Orquestrador Root (Scripts concurrently)
```

> **`backend/schema.postgres.sql` é versionado no repositório** e é a fonte da verdade do schema. `npm run db:schema` aplica o arquivo (idempotente) no banco apontado por `DATABASE_URL`; `npm run db:migrate` aplica as migrações aditivas de `backend/migrations/`. Em um clone limpo, basta configurar o `DATABASE_URL` e rodar os dois comandos para provisionar um banco vazio.

---

## ⚙️ Guia de Inicialização

### Pré-requisitos
- Node.js `v18.0.0` ou superior.
- NPM (Node Package Manager).
- PostgreSQL `16` — local (Docker/instalação nativa) ou um projeto Supabase.

### Instalação (Método Monorepo)

O projeto contém um comando unificado para baixar dependências para a raiz, frontend e backend simultaneamente.

```bash
# 1. Clone o repositório
git clone https://github.com/t10-univespsertaozinho/t10-wash-wizard.git
cd t10-wash-wizard

# 2. Instale todas as dependências da infraestrutura
npm run install:all

# 3. Configure as variáveis de ambiente
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Edite backend/.env:
#   - DATABASE_URL: string de conexão do PostgreSQL/Supabase
#   - JWT_SECRET: segredo próprio (obrigatório fora de um ambiente descartável —
#     sem ele, o servidor gera um segredo aleatório a cada boot e invalida sessões)
#   - TEST_DATABASE_URL: banco descartável usado por `npm test` (nunca o de produção)

# 4. Provisione o schema e popule os dados de exemplo (usuários inclusos)
cd backend
npm run db:schema
npm run db:migrate
npm run seed        # DESTRUTIVO: apaga os dados existentes antes de popular
cd ..
```

### Inicialização e Ambiente de Desenvolvimento

```bash
# Inicia simultaneamente o Back (3001) e Front (8080)
npm run dev
```
*(Após o servidor Vite inicializar, pressione `o` + `Enter` no terminal para abrir automaticamente a aplicação no navegador)*

**Acessos Locais:**
- **Web App:** `http://localhost:8080`
- **Backend API:** `http://localhost:3001/api`

### Testes Automatizados (Frontend)

```bash
cd frontend
npm test                # executa a suíte de testes (91 casos)
npm run test:coverage   # suíte + relatório de cobertura e gate (limiares no vitest.config.ts)
```

### Testes Automatizados (Backend)

Os testes de integração exigem um PostgreSQL descartável em `TEST_DATABASE_URL`
(o helper recusa hosts Supabase para não apagar dados de produção):

```bash
cd backend
npm test                # 43 testes de integração (Vitest + Supertest)
npm run test:watch      # modo watch
```

---

## 🗄️ Gerenciamento de Banco de Dados e Backups

O modelo transacional é gerenciado no PostgreSQL, com integridade referencial garantida por chaves estrangeiras e índices explícitos (`backend/schema.postgres.sql`). O schema usa `TEXT` para chaves primárias (UUIDs gerados na aplicação), `TIMESTAMPTZ` para datas e `NUMERIC` para valores monetários — convertidos para `number` na borda da API pelos *type parsers* de `backend/db.js`.

### Sistema de Backup (CSV)
Visando portabilidade dos dados, a aplicação dispõe de rotinas de serialização:
- **Exportação (Dump):** O administrador pode emitir artefatos `.csv` que mapeiam integralmente o status relacional.
- **Importação (Restore):** A API injeta registros respeitando estritamente a árvore de dependências do esquema (`Usuários -> Clientes -> Veículos -> Lavagens`) dentro de uma transação; qualquer violação de FK desfaz o import inteiro e devolve 400 ("Backup inconsistente").

---

## 🔒 Segurança e Autenticação

A autenticação e a autorização são reforçadas pelo **backend**, não apenas simuladas no cliente:

- **Autenticação JWT:** `POST /api/auth/login` valida a senha contra o hash `bcrypt` armazenado em `users.password_hash` e emite um token JWT (expira em 8h). Toda rota de `/api/*` — exceto o login — exige o header `Authorization: Bearer <token>`, validado pelo middleware `requireAuth`.
- **RBAC (Role-Based Access Control):** aplicado tanto no roteamento do frontend quanto em cada endpoint do backend (`requireAdmin`), então um usuário `operador` não contorna a restrição chamando a API diretamente.
  - **Público:** `/login`
  - **Operador:** Acesso à gestão de Clientes, Veículos, Lavagens e Dashboard `(/)`
  - **Admin:** Acesso adicional a Tipos de Lavagem, Estoque, Novo Produto, Movimentações, **Análise & Relatórios**, Usuários e Configurações (Sistema de Backup)
- **CORS restrito:** o backend só aceita requisições da origem definida em `FRONTEND_URL`.
- **Outras proteções:** allowlist de colunas no import de CSV (previne SQL Injection via cabeçalho malicioso), transações atômicas nas movimentações de estoque (`SELECT ... FOR UPDATE`), e mensagens de erro genéricas ao cliente (o detalhe real do PostgreSQL fica só no log do servidor).

Detalhes completos, incluindo a matriz de permissões por rota, estão em [`SECURITY.md`](./SECURITY.md).

**Credenciais de exemplo (geradas por `backend/seed.js`, senhas configuráveis via `backend/.env`):**
- `admin@washwizard.com` / `admin123` (perfil `admin`)
- `operador@washwizard.com` / `operador123` (perfil `operador`)

---

## 🧭 Situação Atual e Próximos Passos

**Fase recente entregue (UX, Acessibilidade, Segurança e Qualidade):**
- **Cadastro e Aniversário de Clientes:** Suporte ao campo `data_nascimento` (`YYYY-MM-DD`) no fluxo de clientes, persistido no PostgreSQL e disponível nas operações de importação/exportação CSV para promoções e fidelização de aniversariantes do mês.
- **Novas Modais de Gestão:** Inclusão e centralização das telas de *Movimentação de Estoque*, *Novo Serviço* e *Novo Veículo* integradas ao `ModalProvider`.
- **Acessibilidade (a11y):** Adequação rigorosa dos formulários aos padrões W3C / WCAG com associação explícita de `<label htmlFor="...">` para `<input id="...">`, além de contraste verificado e compatibilidade com leitores de tela.
- **Segurança e Auditoria de Dependências:** Atualização de pacotes do backend (`body-parser`, `undici`) para versões seguras, com aprovação em `npm audit --audit-level=high`.
- **Qualidade Automatizada & Cobertura:** Suíte completa com **91 testes no frontend** e **43 testes no backend**, com **gate de cobertura calibrado** no Vitest do CI.

**Próximos passos:**
1. **Cobertura de testes das páginas:** elevar a catraca global de cobertura rumo a **60–70%**, com testes de componente para Dashboard, Análise & Relatórios e fluxos de lavagem.
2. **Data Science e Analytics Avançado** sobre o histórico já registrado (lavagens, clientes, estoque): pipelines de ETL para um datamart analítico (Parquet/DuckDB), métricas como churn, LTV e tempo médio de atendimento, e modelos preditivos de demanda, gestão de estoque e segmentação de clientes (RFM).

Plano detalhado, com sequenciamento e dependências técnicas sugeridas, em [`ROADMAP.md`](./ROADMAP.md).

---

## 🎓 Autores e Licença

Desenvolvido pelo grupo acadêmico do **Projeto Integrador da UNIVESP**.

*Este código e seus ativos são de propriedade exclusiva para fins acadêmicos e para a instituição parceira de aplicação do projeto (Lava Rápido Maquininha). É expressamente proibida a reprodução, comercialização ou re-licenciamento deste software sob quaisquer circunstâncias sem a autorização prévia de todos os mantenedores originários.*
