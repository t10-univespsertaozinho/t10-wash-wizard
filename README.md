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
| Supabase PostgreSQL | Banco de dados na nuvem e sync |
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
│   └── database.ts     # Interface abstrata (LocalStorage/Supabase)
├── utils/               # Utilitários
│   └── security.ts     # Criptografia e sanitização
└── types/              # TypeScript interfaces
```

## Configuração de Ambiente

### Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Tipo de banco de dados: 'localstorage' ou 'supabase'
VITE_DB_TYPE=localstorage

# Chave secreta para assinatura HMAC
VITE_STORAGE_SECRET=sua_chave_secreta

# Supabase (quando VITE_DB_TYPE=supabase)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Segurança

### Proteção LocalStorage

O sistema implementa múltiplas camadas de segurança:

- **Assinatura HMAC**: Sessões de usuário assinadas digitalmente
- **Validação de Timestamp**: Assinaturas expiram após 30 dias
- **Criptografia de Dados**: Dados criptografados antes do armazenamento

### Sincronização Supabase

O projeto implementa sincronização bidirecional entre dados locais e Supabase:

- **Inicialização**: Ao abrir o app, dados são carregados do Supabase (se configurado)
- **Trabalho Local**: Alterações ficam no estado local durante o uso
- **Auto-Sync**: Ao fechar a página, dados são automaticamente enviados para o Supabase
- **Detecção de Conflitos**: Timestamps comparados para identificar alterações remotas
- **Resolução**: Admin é notificado sobre conflitos e pode escolher qual versão manter

### Interface de Sincronização

Na página de configurações (`/configuracoes`), o admin pode:
- Ver o status atual de sincronização (synced/pending/conflict)
- Ver o número de alterações pendentes
- Sincronizar manualmente com botão dedicado
- Resolver conflitos detectados (manter local ou remoto)

### Performance

O projeto inclui otimizações de performance:

- **Code Splitting**: Páginas usam React.lazy + Suspense (carregamento sob demanda)
- **Memoização**: useMemo para cálculos pesados no Dashboard
- **Loading States**: Componentes de carregamento com spinners animadas
- **Bundle Partitioning**: Vite divide o bundle em chunks separados (vendor-supabase, vendor-charts, vendor-ui)

### Supabase (Produção)

Para produção com Supabase, o projeto usa RLS:

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

### Modo 2: Supabase (Produção)

Banco de dados cloud com autenticação:

```bash
VITE_DB_TYPE=supabase
# + variáveis do Supabase
```

**Vantagens:**
- Dados na nuvem
- Acesso multiplataforma
- Autenticação real
- Multi-usuário com controle de acesso

**Configuração:**
1. Crie projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **Project Settings -> API** para pegar a URL e Anon Key
3. Crie as tabelas com colunas adequadas (id, created_at, updated_at, etc)
4. Habilite e configure as políticas **RLS (Row Level Security)**

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
- **Modo Supabase**: Dados na nuvem (ideal para produção)
- Campos com validações em tempo real
- Instruções passo a passo para obter credenciais
- Botão para testar conexão
- Mensagens de feedback claras

### Recursos de Segurança
- Validação de formato de URL (Supabase URL)
- Validação de Anon Key
- Credenciais armazenadas com segurança no navegador
- Opção de testar conexão antes de salvar

## Camada de Abstração de Dados

O projeto usa uma interface `Database` que permite alternar entre LocalStorage e Supabase:

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
    case 'supabase': return supabaseDB;
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
- Em produção, use Supabase Auth ou a segurança de HMAC offline
- Configure regras de segurança (RLS) no Supabase
- Usuário é assinado com HMAC para evitar manipulação
- Dados LocalStorage são criptografados

## Resolução de Problemas

### Dados não aparecem após login
- Limpe o localStorage: `localStorage.clear()`
- Atualize a página

### Erro de assinatura HMAC
- A sessão expirou ou foi manipulada
- Faça logout e login novamente

### Supabase não conecta
- Verifique as variáveis no `.env` ou tela de configurações
- Verifique as permissões de rede

## Licença

Este projeto é de uso exclusivo para fins acadêmicos (**Projeto Integrador UNIVESP**) e para a empresa parceira. Todos os direitos reservados. Não é permitida a redistribuição, cópia ou uso comercial sem autorização prévia dos autores e da instituição.
