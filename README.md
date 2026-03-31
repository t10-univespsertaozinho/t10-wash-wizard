# Wash Wizard

Sistema de gerenciamento para lava rápido com controle de clientes, lavagens, estoque e finanças.

## Quick Start

```bash
# Clone o projeto
git clone https://github.com/seu-usuario/t10-wash-wizard.git
cd t10-wash-wizard

# Instale dependências
npm install

# Configure o ambiente
cp .env.example .env

# Inicie o desenvolvimento
npm run dev
```

## Tech Stack

| Tecnologia | Uso |
|------------|-----|
| React 18 + TypeScript | Frontend framework |
| Vite | Build tool e dev server |
| shadcn-ui + Tailwind CSS | Component library |
| React Router DOM | Roteamento |
| React Hook Form + Zod | Formulários e validação |
| Firebase Auth + Firestore | Autenticação e banco de dados |
| Recharts | Gráficos e dashboards |

## Arquitetura do Projeto

```
src/
├── components/          # Componentes reutilizáveis UI
│   └── ui/             # Componentes shadcn-ui
├── contexts/           # React Contexts
│   ├── AuthContext.tsx # Autenticação
│   └── AppContext.tsx  # Estado global da aplicação
├── pages/              # Páginas principais
├── services/           # Camada de dados
│   └── database.ts     # Interface abstrata (LocalStorage/Firebase)
├── lib/                # Utilitários
│   └── firebase.ts     # Configuração Firebase SDK
└── types/              # TypeScript interfaces
```

## Configuração de Ambiente

### Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Tipo de banco de dados: 'localstorage' ou 'firebase'
VITE_DB_TYPE=localstorage

# Firebase (quando VITE_DB_TYPE=firebase)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Credenciais locais (apenas para modo localstorage)
VITE_ADMIN_EMAIL=admin@washwizard.com
VITE_ADMIN_PASSWORD=admin123
VITE_USER_EMAIL=user@washwizard.com
VITE_USER_PASSWORD=user123
```

## Modos de Desenvolvimento

### Modo 1: LocalStorage (Desenvolvimento Rápido)

Sem configuração externa - usa o browser como banco de dados:

```bash
VITE_DB_TYPE=localstorage
```

**Vantagens:**
- Sem configuração
- Sem necessidade de conta Firebase
- Rápido para prototipagem

**Limitações:**
- Dados ficam no browser
- Não sincroniza entre dispositivos
- Dados perdidos ao limpar cache

### Modo 2: Firebase (Produção)

Banco de dados cloud com autenticação:

```bash
VITE_DB_TYPE=firebase
# + variáveis do Firebase
```

**Vantagens:**
- Dados na nuvem
- Acesso multiplataforma
- Autenticação real
- Multi-usuário com controle de acesso

**Configuração:**
1. Crie projeto no [Firebase Console](https://console.firebase.google.com)
2. Ative **Authentication** → Email/Password
3. Crie **Firestore Database** (modo produção)
4. Configure as regras de segurança (vide `SECURITY.md`)

## Camada de Abstração de Dados

O projeto usa uma interface `Database` que permite alternar entre LocalStorage e Firebase sem alterar o código das páginas:

```typescript
// src/services/database.ts
export interface Database {
  initialize(): Promise<void>;
  
  // Clientes
  getClientes(userId: string): Promise<Cliente[]>;
  createCliente(data: Omit<Cliente, 'id' | 'created_at'>): Promise<Cliente>;
  updateCliente(id: string, data: Partial<Cliente>): Promise<Cliente>;
  deleteCliente(id: string): Promise<void>;
  
  // Veículos
  getVeiculos(userId: string): Promise<Veiculo[]>;
  getVeiculosByCliente(clienteId: string): Promise<Veiculo[]>;
  // ... etc
}

export function getDatabase(): Database {
  const type = import.meta.env.VITE_DB_TYPE;
  switch (type) {
    case 'firebase': return firebaseDB;
    default: return localStorageDB;
  }
}
```

## Schema do Banco de Dados

### Relações

```
clientes (1) ──────< (N) veiculos
    │                    │
    └────< (N) lavagens -< (N) tipos_lavagem
                           │
produtos (1) ─────< (N) movimentacoes_estoque
```

### Collections/Tabelas

| Entidade | Descrição |
|----------|-----------|
| `clientes` | Dados dos clientes (nome, telefone) |
| `veiculos` | Veículos vinculados a clientes |
| `lavagens` | Registros de lavagens |
| `tipos_lavagem` | Tipos de serviço disponíveis |
| `produtos` | Estoque de produtos |
| `movimentacoes` | Movimentações de estoque |
| `users` | Perfis de usuários (role: admin/user) |

Consulte `docs/DATABASE_SCHEMA.md` para detalhes completos.

## Controle de Acesso

| Rota | Acesso |
|------|--------|
| `/login` | Público |
| `/` (Dashboard) | Autenticado |
| `/clientes` | Autenticado |
| `/lavagens` | Autenticado |
| `/tipos-lavagem` | Admin |
| `/estoque` | Admin |
| `/novo-produto` | Admin |
| `/movimentacao` | Admin |

## Autenticação Firebase

O sistema suporta dois modos:

### Modo LocalStorage
Credenciais definidas no `.env` (admin@washwizard.com / admin123)

### Modo Firebase
Email/senha cadastrados no Firebase Authentication console

**Estrutura do usuário:**
```typescript
interface AppUser {
  id: string;        // Firebase UID
  nome: string;
  email: string;
  role: 'admin' | 'user';
}
```

## Deploy

### Lovable + GitHub

1. Faça push para o GitHub
2. O Lovable detecta automaticamente
3. Deploy disponível em tempo real

### Build Produção

```bash
npm run build
# Saída em dist/
```

## Scripts Disponíveis

```bash
npm run dev        # Servidor desenvolvimento (porta 5173)
npm run build      # Build produção
npm run build:dev # Build modo desenvolvimento
npm run lint      # Verificar código ESLint
npm run test      # Executar testes Vitest
npm run preview   # Preview do build
```

## Considerações de Segurança

- **NUNCA** commite credenciais reais no `.env`
- O arquivo está no `.gitignore`
- Em produção, use Firebase Auth
- Configure regras de segurança no Firestore
- Veja `SECURITY.md` para guidelines completos

## Resolução de Problemas

### Erro de build Firebase
```bash
# Verifique se as variáveis estão no .env
# Formato: VITE_FIREBASE_*
```

### Dados não aparecem
```bash
# Modo localstorage: limpe o localStorage do browser
# Modo firebase: verifique as regras de segurança
```

### Erro de lint
```bash
npm run lint
# Corrija os erros reportados
```

## License

MIT - Feel free to use and contribute!
