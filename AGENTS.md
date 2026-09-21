# Wash Wizard - Project Notes (Academic Version)

## Current Architecture

- **Data Storage**: SQLite3 Relational Database via Node.js Backend API
- **Frontend**: React 18, Vite, Tailwind CSS (running on port 8080)
- **Backend**: Node.js, Express (running on port 3001)
- **Backup Strategy**: CSV import/export for data portability (SQLite remains primary DB)
- **Authentication**: Real backend authentication — `POST /api/auth/login` validates credentials against `users.password_hash` (bcrypt) and issues a JWT. All `/api/*` routes except login require a valid `Authorization: Bearer <token>` header (`requireAuth` middleware); admin-only routes additionally require `requireAdmin`. See `SECURITY.md` for the full RBAC matrix.
- **Performance**: Code splitting with React.lazy + Suspense, memoization with useMemo

## Features

- Client and vehicle management
- Wash tracking (pending/in-progress/completed/cancelled)
- Inventory management with stock alerts
- Financial dashboard with charts (Recharts)
- Role-based access control (Admin vs Operador), enforced both in the frontend routing and in the backend API
- **Admin settings page for Backup Management**
- **Lazy loading of pages** for better performance

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

Para o próximo eixo de trabalho do projeto (Data Science / Analytics), veja `ROADMAP.md`.

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
