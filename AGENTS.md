# Wash Wizard - Project Notes (Academic Version)

## Current Architecture

- **Data Storage**: SQLite3 Relational Database via Node.js Backend API
- **Frontend**: React 18, Vite, Tailwind CSS (running on port 8080)
- **Backend**: Node.js, Express (running on port 3001)
- **Backup Strategy**: CSV import/export for data portability (SQLite remains primary DB)
- **Authentication**: Local credentials with HMAC signature validation (simulating auth in frontend)
- **Performance**: Code splitting with React.lazy + Suspense, memoization with useMemo

## Features

- Client and vehicle management
- Wash tracking (pending/in-progress/completed/cancelled)
- Inventory management with stock alerts
- Financial dashboard with charts (Recharts)
- Role-based access control (Admin vs User)
- **Admin settings page for Backup Management**
- **Lazy loading of pages** for better performance

## SQL Structure (Node.js & SQLite)
The system uses an adapted SQLite schema `backend/schema.sql`.
- PostgreSQL's `uuid` was converted to `TEXT`
- Default date fields use `TEXT` storing ISO 8601 strings.
- Numeric constraints apply to REAL types.
- Foreign keys are enforced in SQLite (`PRAGMA foreign_keys = ON;`).

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
