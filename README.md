# Wash Wizard (Versão Acadêmica - SQLite)

Sistema de gerenciamento para lava rápido com controle de clientes, lavagens, estoque e finanças.
Esta versão foi adaptada especificamente para o **Projeto Integrador Acadêmico (UNIVESP - Engenharia de Computação)**, utilizando uma arquitetura 100% local com SQLite como banco de dados principal.

## Arquitetura do Projeto

Consulte a **[Documentação Completa do Projeto em HTML](./documentacao.html)** para uma visão detalhada, diagramas e explicação da arquitetura.

A aplicação está dividida em duas camadas principais:

```
wash-wizard/
├── frontend/          # React 18 + Vite (Porta 8080)
│   ├── src/           # Componentes, Páginas, Contextos e Serviços
│   └── package.json
├── backend/           # Node.js + Express (Porta 3001)
│   ├── db.js          # Conexão SQLite + Inicialização do schema
│   ├── server.js      # Rotas REST e regras de backup
│   ├── schema.sql     # Estrutura do banco adaptada de Postgres
│   └── package.json
├── package.json       # Orquestrador (concurrently)
└── wash_wizard.db     # Gerado automaticamente (SQLite DB)
```

## Tech Stack

| Tecnologia | Uso |
|------------|-----|
| Node.js + Express | Backend API |
| SQLite3 | Banco de Dados Relacional (Acadêmico) |
| React 18 + TypeScript | Frontend framework |
| Vite | Build tool e dev server |
| shadcn-ui + Tailwind CSS | Component library |
| TanStack React Query | Gerenciamento de estado e chamadas API |

## Configuração Local para Projeto Acadêmico

### Requisitos
- Node.js (v18+)
- NPM

### Instalação

```bash
# 1. Instalar todas as dependências (raiz, backend e frontend)
npm run install:all

# 2. Configurar o ambiente do frontend
cp frontend/.env.example frontend/.env

# 3. Iniciar o projeto (Backend e Frontend rodarão simultaneamente)
npm run dev
```

> **Acesso**: 
> - Frontend: http://localhost:8080
> - Backend API: http://localhost:3001/api

## Sistema de Backup (CSV)

O banco de dados principal é o SQLite (`wash_wizard.db`). O formato CSV é utilizado **estritamente como mecanismo de backup e exportação**.

- **Exportar**: Através da página `/configuracoes`, você pode exportar todo o banco de dados em múltiplos arquivos `.csv`.
- **Importar**: O sistema limpa as tabelas com integridade referencial mantida, injetando os registros em ordem de dependência (usuários -> clientes -> veículos -> etc) usando os dados do arquivo CSV enviado.

## Controle de Acesso e Segurança

| Rota | Acesso |
|------|--------|
| `/login` | Público |
| `/` (Dashboard) | Autenticado |
| `/clientes` | Autenticado |
| `/lavagens` | Autenticado |
| `/tipos-lavagem` | Admin |
| `/estoque` | Admin |
| `/configuracoes` | Admin |

> **Nota:** Por ser um projeto acadêmico de simulação, existem perfis padrão (admin@washwizard.com / admin123 e user@washwizard.com / user123) cujas sessões são validadas com HMAC no front e conectadas aos `users` do banco relacional via ID.

## Licença

Este projeto é de uso exclusivo para fins acadêmicos (**Projeto Integrador UNIVESP**) e para a empresa parceira. Todos os direitos reservados. Não é permitida a redistribuição, cópia ou uso comercial sem autorização prévia dos autores e da instituição.
