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
| TanStack React Query | Gerenciamento de estado |
| Firebase Auth + Firestore | Autenticação e banco de dados (opcional) |
| React.lazy + Suspense | Code splitting |
| Recharts | Gráficos e dashboards |

## Arquitetura do Projeto

```
src/
├── components/          # Componentes reutilizáveis UI
│   └── ui/             # Componentes shadcn-ui
├── contexts/           # React Contexts
│   ├── AuthContext.tsx # Autenticação com HMAC
│   └── AppContext.tsx  # Estado global com criptografia
├── pages/              # Páginas principais
├── services/           # Camada de dados
│   └── database.ts     # Interface abstrata (LocalStorage/Firebase)
├── utils/               # Utilitários
│   └── security.ts     # Criptografia e sanitização
└── types/              # TypeScript interfaces
```

## Configuração de Ambiente

### Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Tipo de banco de dados: 'localstorage' ou 'firebase'
VITE_DB_TYPE=localstorage

# Chave secreta para assinatura HMAC
VITE_STORAGE_SECRET=sua_chave_secreta

# Firebase (quando VITE_DB_TYPE=firebase)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Segurança

### Proteção LocalStorage

O sistema implementa múltiplas camadas de segurança:

- **Assinatura HMAC**: Sessões de usuário assinadas digitalmente
- **Validação de Timestamp**: Assinaturas expiram após 30 dias
- **Criptografia de Dados**: Dados criptografados antes do armazenamento

### Performance

O projeto inclui otimizações de performance:

- **Code Splitting**: Páginas usam React.lazy + Suspense (carregamento sob demanda)
- **Memoização**: useMemo para cálculos pesados no Dashboard
- **Loading States**: Componentes de carregamento com spinners animadas
- **Bundle Partitioning**: Vite divide o bundle em chunks separados (vendor-firebase, vendor-charts, vendor-ui)

### Firebase (Produção)

Para produção com Firebase, o projeto inclui regras completas em `firestore.rules`:

| Coleção | Leitura | Escrita |
|---------|---------|---------|
| `clientes` | Proprietário ou Admin | Proprietário ou Admin |
| `veiculos` | Via cliente owner | Via cliente owner |
| `lavagens` | Via cliente owner | Via cliente owner |
| `produtos` | Usuários autenticados | Apenas Admin |
| `movimentacoes` | Usuários autenticados | Apenas Admin |
| `tipos_lavagem` | Usuários autenticados | Apenas Admin |
| `users` | Próprio perfil | Próprio perfil (sem mudança de role) |

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
- Dados criptografados localmente

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
4. Faça deploy das regras: `firebase deploy --only firestore:rules`

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
| `/configuracoes` | Admin |

## Página de Configurações

O sistema inclui uma página de configurações acessível apenas para administradores (`/configuracoes`) que permite:

### Configuração do Banco de Dados
- **Modo Local**: Dados armazenados no navegador (ideal para testes)
- **Modo Firebase**: Dados na nuvem (ideal para produção)

### Interface Amigável
- Seleção visual entre Local e Firebase
- Campos com validações em tempo real
- Instruções passo a passo para obter credenciais
- Botão para testar conexão
- Mensagens de feedback claras

### Recursos de Segurança
- Validação de formato de URL (Firebase domain)
- Validação de Project ID (apenas letras minúsculas, números e hífens)
- Validação de API Key (mínimo 10 caracteres)
- Credenciais armazenadas com segurança no navegador
- Opção de testar conexão antes de salvar

## Camada de Abstração de Dados

O projeto usa uma interface `Database` que permite alternar entre LocalStorage e Firebase:

```typescript
// src/services/database.ts
export interface Database {
  initialize(): Promise<void>;
  getClientes(userId: string): Promise<Cliente[]>;
  createCliente(data: Omit<Cliente, 'id' | 'created_at'>): Promise<Cliente>;
  // ... outros métodos
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

## Deploy

### Lovable + GitHub

1. Faça push para o GitHub
2. O Lovable detecta automaticamente
3. Deploy disponível em tempo real

### Dados de Teste

O sistema inclui um botão **"Carregar Dados"** no Dashboard que gera dados fictícios automaticamente para演示ções:

- **4 clientes fictícios**: João Silva, Maria Oliveira, Carlos Santos, Ana Paula
- **4 veículos**: Toyota Corolla, Honda Civic, Volkswagen Gol, Ford Ka
- **3 produtos**: Shampoo Automotivo, Cera de Polimento, Limpa Vidros
- **Lavagens**: Dados dos últimos 6 meses com datas, valores e status variados
- **Movimentações**: Entradas e saídas de estoque

Para usar:
1. Faça login como admin (`admin@washwizard.com` / `admin123`)
2. Clique em "Carregar Dados" no Dashboard
3. Dados fictícios serão criados automaticamente

### Build Produção

```bash
npm run build
# Saída em dist/
```

## Scripts Disponíveis

```bash
npm run dev        # Servidor desenvolvimento (porta 8080)
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
- Usuário é assinado com HMAC para evitar manipulação
- Dados LocalStorage são criptografados

## Resolução de Problemas

### Dados não aparecem após login
- Limpe o localStorage: `localStorage.clear()`
- Atualize a página

### Erro de assinatura HMAC
- A sessão expirou ou foi manipulada
- Faça logout e login novamente

### Firebase não conecta
- Verifique as variáveis no `.env`
- Configure as regras de segurança

## License

MIT - Feel free to use and contribute!
