# Schema Relacional - Wash Wizard (Supabase)

Este documento descreve o schema de banco de dados PostgreSQL para integração com Supabase.

## Diagrama de Relações

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │       │  Clientes   │       │ TiposLavagem│
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ user_id (FK)│      │ id (PK)     │
│ email       │       │ id (PK)     │──┐    │ nome        │
│ nome        │       │ nome        │  │    │ descricao   │
│ role        │       │ telefone    │  │    │ preco       │
│ created_at  │       │ user_id     │  │    └─────────────┘
└─────────────┘       │ created_at  │──┘            ▲
                      └─────────────┘  │            │
                              │        │            │
                              ▼        │            │
                      ┌─────────────┐  │            │
                      │  Veículos   │  │            │
                      ├─────────────┤  │            │
                      │ id (PK)     │──┘            │
                      │ cliente_id  │◄──────────────┘
     ┌─────────────┐  │ user_id     │
     │  Produtos   │  │ placa       │
     ├─────────────┤  │ marca       │
     │ id (PK)     │──│ cor         │
     │ nome        │  │ modelo      │
     │ quantidade  │  └─────────────┘
     │ estoque_min │          │
     │ categoria   │          │
     │ unidade     │          ▼
     │ preco_unit  │   ┌─────────────┐
     │ user_id     │   │  Lavagens   │
     │ created_at  │   ├─────────────┤
     └─────────────┘   │ id (PK)     │◄──────────────┘
           ▲           │ cliente_id  │
           │           │ veiculo_id  │
           │           │ tipo_lav... │
           │           │ status      │
           ▼           │ valor       │
     ┌─────────────┐   │ data        │
     │Movimentações│   │ user_id     │
     ├─────────────┤   │ pagamento   │
     │ id (PK)     │   │ observacao  │
     │ produto_id  │   │ data_conc...│
     │ tipo        │   └─────────────┘
     │ quantidade  │
     │ observacao  │
     │ user_id     │
     │ data        │
     └─────────────┘
```

## Tabelas

### users
| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | uuid | PK, FK → auth.users | ID do usuário (referência auth.users) |
| email | text | NOT NULL | Email do usuário |
| nome | text | - | Nome completo |
| role | text | NOT NULL, CHECK ('admin', 'operador') | Papel do usuário |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Data de criação |

### clientes
| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ID do cliente |
| user_id | uuid | FK → users(id), NOT NULL | ID do proprietário |
| nome | text | NOT NULL | Nome completo do cliente |
| telefone | text | - | Telefone/WhatsApp |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Data de criação |

### veiculos
| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ID do veículo |
| cliente_id | uuid | FK → clientes(id), NOT NULL, ON DELETE CASCADE | ID do cliente |
| user_id | uuid | FK → users(id) | ID do proprietário |
| placa | text | NOT NULL | Placa (única) |
| marca | text | - | Marca do veículo |
| cor | text | - | Cor do veículo |
| modelo | text | NOT NULL | Modelo do veículo |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Data de criação |

### tipos_lavagem
| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ID do tipo |
| nome | text | NOT NULL | Nome do serviço |
| descricao | text | - | Descrição detalhada |
| preco | numeric(10,2) | NOT NULL | Preço do serviço |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Data de criação |

### lavagens
| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ID da lavagem |
| cliente_id | uuid | FK → clientes(id), NOT NULL | ID do cliente |
| veiculo_id | uuid | FK → veiculos(id), NOT NULL | ID do veículo |
| tipo_lavagem_id | uuid | FK → tipos_lavagem(id), NOT NULL | ID do tipo de lavagem |
| status | text | CHECK ('pendente', 'em_progresso', 'concluida', 'cancelada') | Status da lavagem |
| valor | numeric(10,2) | NOT NULL | Valor da lavagem |
| data | timestamptz | NOT NULL, DEFAULT now() | Data/hora da lavagem |
| user_id | uuid | FK → users(id) | ID do usuário |
| pagamento | text | DEFAULT 'Pendente' | Forma de pagamento |
| observacao | text | - | Observações |
| data_conclusao | timestamptz | - | Data de conclusão |

### produtos
| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ID do produto |
| nome | text | NOT NULL | Nome do produto |
| quantidade | integer | NOT NULL, DEFAULT 0 | Quantidade em estoque |
| estoque_minimo | integer | NOT NULL, DEFAULT 5 | Estoque mínimo para alerta |
| categoria | text | DEFAULT 'Outros' | Categoria do produto |
| unidade | text | DEFAULT 'un' | Unidade de medida |
| preco_unitario | numeric(10,2) | DEFAULT 0 | Preço por unidade |
| user_id | uuid | FK → users(id) | ID do proprietário |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Data de criação |

### movimentacoes
| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ID da movimentação |
| produto_id | uuid | FK → produtos(id), NOT NULL | ID do produto |
| tipo | text | CHECK ('entrada', 'saida'), NOT NULL | Tipo de movimentação |
| quantidade | integer | NOT NULL | Quantidade movimentada |
| observacao | text | - | Observação |
| user_id | uuid | FK → users(id) | ID do usuário |
| data | timestamptz | NOT NULL, DEFAULT now() | Data da movimentação |

## Integração Supabase

### SQL de Criação

```sql
-- 1. Tabela de Usuários/Perfis (Estende a auth.users do Supabase)
create table public.users (
  id uuid references auth.users not null primary key,
  email text not null,
  nome text,
  role text not null check (role in ('admin', 'operador')) default 'operador',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Clientes
create table public.clientes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  nome text not null,
  telefone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Veículos
create table public.veiculos (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  user_id uuid references public.users(id),
  placa text not null,
  marca text,
  cor text,
  modelo text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela de Tipos de Lavagem
create table public.tipos_lavagem (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  preco numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabela de Lavagens
create table public.lavagens (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references public.clientes(id) not null,
  veiculo_id uuid references public.veiculos(id) not null,
  tipo_lavagem_id uuid references public.tipos_lavagem(id) not null,
  status text check (status in ('pendente', 'em_progresso', 'concluida', 'cancelada')) default 'pendente',
  valor numeric(10,2) not null,
  data timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.users(id),
  pagamento text default 'Pendente',
  observacao text,
  data_conclusao timestamp with time zone
);

-- 6. Tabela de Produtos (Estoque)
create table public.produtos (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  quantidade integer not null default 0,
  estoque_minimo integer not null default 5,
  categoria text default 'Outros',
  unidade text default 'un',
  preco_unitario numeric(10,2) default 0,
  user_id uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Tabela de Movimentações de Estoque
create table public.movimentacoes (
  id uuid default gen_random_uuid() primary key,
  produto_id uuid references public.produtos(id) not null,
  tipo text check (tipo in ('entrada', 'saida')) not null,
  quantidade integer not null,
  observacao text,
  user_id uuid references public.users(id),
  data timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Políticas RLS (Row Level Security)

Exemplo de políticas de segurança:

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lavagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_lavagem ENABLE ROW LEVEL SECURITY;

-- Política: usuários leem apenas seus próprios dados
CREATE POLICY " users_select" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY " clientes_select" ON clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY " veiculos_select" ON veiculos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY " lavagens_select" ON lavagens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY " produtos_select" ON produtos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY " movimentacoes_select" ON movimentacoes FOR SELECT USING (auth.uid() = user_id);

-- Política: admin gerencia produtos e movimentações
CREATE POLICY " produtos_admin" ON produtos FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
```