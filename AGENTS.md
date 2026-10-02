# Wash Wizard - Project Notes (Academic & Enterprise Version)

## Current Architecture

- **Data Storage**: SQLite3 Relational Database via Node.js Backend API (`wash_wizard.db` with indexed foreign keys).
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts (running on port 8080).
- **Backend**: Node.js, Express (running on port 3001).
- **Analytics & BI**: Centralized server-side aggregations with SQLite CTEs via `GET /api/dashboard/stats` (<30ms latency, ~1.2 KB JSON payload).
- **Backup Strategy**: Relational CSV import/export for full data portability with transactional rollback.
- **Authentication**: JWT-based stateless authentication (`POST /api/auth/login` with bcrypt verification). All `/api/*` endpoints require `Authorization: Bearer <token>`, with RBAC enforced at middleware level (`requireAuth` / `requireAdmin`).
- **Performance**: Route-based code splitting with React.lazy + Suspense, server-side data aggregation to minimize client memory footprint.

## Features

- Complete client and vehicle management with relational integrity.
- Wash tracking workflow (pending, in-progress, completed, cancelled) with live patio queue.
- Inventory management with stock alerts, transaction history, and predictive runway calculation.
- **Business Intelligence (BI) Dashboard**: 4 decision pillars (Financial Health, Mix of Services, Supply Runway, and Retention/WhatsApp Re-engagement).
- Role-based access control (Admin vs Operador), enforced in frontend routing and backend API.
- Admin settings for CSV backup/restore and database initialization.
- Full visual accessibility (Okabe-Ito colorblind-safe palette, ChartDataTable for screen readers).

## Case Study & Field Validation
This software serves as a generic management & analytics platform for automotive detailing centers and car washes. Its empirical validation was conducted in the field at **Lava Rápido Maquininha** (managed by Mr. Reinaldo) as part of the **UNIVESP Computer Engineering Capstone Project (Projeto Integrador)**.

## SQL Structure (Node.js & SQLite)
The system uses an adapted SQLite schema `backend/schema.sql`.
- PostgreSQL's `uuid` was converted to `TEXT`
- Default date fields use `TEXT` storing ISO 8601 strings.
- Numeric constraints apply to REAL types.
- Foreign keys are enforced in SQLite (`PRAGMA foreign_keys = ON;`).
- Database seed script relies on `db.serialize()` to guarantee synchronous setup execution, preventing foreign key constraint drops during parallel creation.
- **`backend/schema.sql` is version-controlled** in the repository (there is an explicit `.gitignore` exception for it, since the broader `*.sql` rule is meant for data dumps, not the schema itself). `backend/db.js` runs it automatically to bootstrap `wash_wizard.db` from scratch when the database file doesn't exist yet.
- A comprehensive HTML documentation file is available at `documentacao.html` at the project root.

## Environment Variables

`backend/.env` (copy from `backend/.env.example`):

| Variável | Obrigatória | Descrição |
|---|:---:|---|
| `PORT` | Não (padrão `3001`) | Porta do servidor Express |
| `FRONTEND_URL` | Recomendada | Origem liberada no CORS (padrão `http://localhost:8080`) |
| `JWT_SECRET` | Recomendada | Segredo usado para assinar os tokens JWT. Se ausente, um segredo aleatório é gerado a cada boot do servidor (sessões não sobrevivem a um restart) |
| `SEED_ADMIN_PASSWORD` / `SEED_OPERADOR_PASSWORD` | Não (padrões `admin123`/`operador123`) | Senhas usadas por `backend/seed.js` ao criar os usuários iniciais |

`frontend/.env` (copy from `frontend/.env.example`):

| Variável | Obrigatória | Descrição |
|---|:---:|---|
| `VITE_API_URL` | Não (padrão `http://localhost:3001/api`) | Base URL da API consumida pelo frontend |

## API — Autenticação

Todas as rotas de `/api/*`, exceto `POST /api/auth/login`, exigem o header:

```
Authorization: Bearer <token>
```

O token é obtido em `POST /api/auth/login` (`{ email, senha }` → `{ token, user }`) e expira em 8 horas. Rotas administrativas (tipos de lavagem, estoque, movimentações, usuários, backup) exigem adicionalmente que o usuário do token tenha `role: "admin"` — ver a matriz completa em `SECURITY.md`, seção 3.

### API de Business Intelligence & Analytics
- **`GET /api/dashboard/stats`**: Endpoint autenticado (`requireAuth`, acessível para `admin` e `operador`). Retorna agregações consolidadas do banco de dados em tempo real (<30ms):
  - `financeiro`: receita semanal, lavagens semanais, ticket médio, comparativos percentuais com período anterior (`variacao_receita_pct`, `variacao_ticket_pct`) e série de 7 dias preenchida (`fluxo_diario_7d`).
  - `fidelizacao`: contagem de clientes com lavagem concluída, clientes recorrentes ($\ge 2$ atendimentos) e taxa percentual de recorrência.
  - `clientes_ausentes`: top 5 clientes habituais sem comparecimento há mais de 30 dias com data da última visita, dias ausente e histórico.
  - `mix_servicos`: análise de 30 dias com volume de atendimentos, faturamento por tipo, `% de volume` e `% de receita`.
  - `estoque_critico`: produtos com saldo $\le$ estoque mínimo, consumo diário médio baseado em `movimentacoes` e projeção de *Runway* (dias restantes).

### Tipagens TypeScript do Módulo Analítico (`frontend/src/types/index.ts`)
```typescript
export interface FluxoDiarioItem {
  data: string;
  dia: string;
  lavagens: number;
  receita: number;
}

export interface DashboardStats {
  financeiro: {
    receita_semana: number;
    lavagens_semana: number;
    ticket_medio: number;
    receita_semana_anterior: number;
    lavagens_semana_anterior: number;
    variacao_receita_pct: number;
    variacao_ticket_pct: number;
    fluxo_diario_7d: FluxoDiarioItem[];
  };
  fidelizacao: {
    total_clientes_com_lavagem: number;
    clientes_recorrentes: number;
    taxa_recorrencia_pct: number;
  };
  clientes_ausentes: Array<{
    id: string;
    nome: string;
    telefone: string;
    ultima_visita: string;
    dias_ausente: number;
    historico_lavagens: number;
  }>;
  mix_servicos: Array<{
    id: string;
    nome: string;
    total_atendimentos: number;
    faturamento_total: number;
    pct_volume: number;
    pct_receita: number;
  }>;
  estoque_critico: Array<{
    id: string;
    nome: string;
    quantidade: number;
    estoque_minimo: number;
    unidade: string;
    consumo_diario: number;
    dias_restantes: number | null;
    status_previsao: 'zerado' | 'urgente' | 'atencao' | 'moderado' | 'repor';
  }>;
}
```

Para o próximo eixo de trabalho do projeto (Data Science / Analytics avançado com ETL), veja `ROADMAP.md`.

## Quick Start

```bash
# Clone o projeto
git clone https://github.com/t10-univespsertaozinho/t10-wash-wizard.git
cd t10-wash-wizard

# Instale dependências de todas as camadas
npm run install:all

# Inicie os dois servidores (Front/Back)
npm run dev

# Para abrir o navegador automaticamente
# Após o servidor iniciar, digite 'o' + Enter
```

## Frontend Dependencies

O projeto usa as seguintes dependências principais no frontend:

| Pacote | Versão | Observações |
|--------|--------|-------------|
| Vite | ^8.0.10 | Build tool e dev server |
| @vitejs/plugin-react | ^5.0.0 | Plugin oficial React para Vite |
| lovable-tagger | ^1.3.0 | Analytics (opcional) |

### Notas sobre Instalação

```bash
# Se houver problemas de peer dependencies, use:
cd frontend && npm install --legacy-peer-deps

# Para verificar se há erros de build:
npm run build
```

## Run Commands

```bash
npm run dev        # Development server (ports 8080 frontend, 3001 backend)
npm run build      # Production build
npm run lint       # Lint code
npm run install:all # Install all dependencies (root, backend, frontend)
```
