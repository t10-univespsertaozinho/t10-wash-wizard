# Schema Relacional - Wash Wizard

Este documento descreve o schema de banco de dados para integração com BaaS (Firebase/Supabase).

## Diagrama de Relações

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Clientes   │       │  Veículos   │       │ TiposLavagem│
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)     │       │ id (PK)     │
│ nome        │  │    │ cliente_id  │──┐    │ nome        │
│ telefone    │  │    │ modelo      │  │    │ descricao   │
│ user_id     │  │    │ placa       │  │    │ preco       │
│ created_at  │──┘    │ cor         │  │    └─────────────┘
└─────────────┘       │ user_id     │  │            ▲
                      └─────────────┘  │            │
                              │        │            │
                              ▼        │            │
                      ┌─────────────┐  │            │
                      │  Lavagens   │  │            │
                      ├─────────────┤  │            │
                      │ id (PK)     │──┘            │
                      │ cliente_id  │◄───────────────┘
    ┌─────────────┐   │ veiculo_id  │
    │  Produtos   │   │ tipo_lav... │
    ├─────────────┤   │ status      │
    │ id (PK)     │───│ pagamento   │
    │ nome        │   │ valor       │
    │ categoria   │   │ observacao  │
    │ quantidade │   │ user_id     │
    │ estoque_min│   │ data        │
    │ unidade    │   │ data_conc...│
    │ preco_unit │   └─────────────┘
    └─────────────┘          │
            ▲                 │
            │                 │
            ▼                 │
    ┌─────────────┐          │
    │Movimentações│          │
    ├─────────────┤          │
    │ id (PK)     │          │
    │ produto_id  │──────────┘
    │ tipo        │
    │ quantidade  │
    │ observacao  │
    │ user_id     │
    │ data        │
    └─────────────┘
```

## Tabelas/Collections

### clientes
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string (UUID) | Chave primária |
| nome | string | Nome completo do cliente |
| telefone | string | Telefone/WhatsApp |
| user_id | string (UUID) | ID do usuário (multi-tenant) |
| created_at | timestamp | Data de criação |

### veiculos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string (UUID) | Chave primária |
| cliente_id | string (UUID) | FK → clientes.id |
| modelo | string | Modelo do veículo |
| placa | string | Placa (única) |
| cor | string | Cor do veículo |
| user_id | string (UUID) | ID do usuário |

### tipos_lavagem
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string (UUID) | Chave primária |
| nome | string | Nome do serviço |
| descricao | string | Descrição detalhada |
| preco | number | Preço do serviço |

### lavagens
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string (UUID) | Chave primária |
| cliente_id | string (UUID) | FK → clientes.id |
| veiculo_id | string (UUID) | FK → veiculos.id |
| tipo_lavagem_id | string (UUID) | FK → tipos_lavagem.id |
| status | enum | pendente, em_andamento, concluida, cancelada |
| pagamento | string | Forma de pagamento |
| valor | number | Valor da lavagem |
| observacao | string | Observações |
| user_id | string (UUID) | ID do usuário |
| data | timestamp | Data/hora da lavagem |
| data_conclusao | timestamp | Data de conclusão |

### produtos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string (UUID) | Chave primária |
| nome | string | Nome do produto |
| categoria | enum | Limpeza, Polimento, Proteção, Outros |
| quantidade | number | Quantidade em estoque |
| estoque_minimo | number | Estoque mínimo para alerta |
| unidade | string | Unidade de medida |
| preco_unitario | number | Preço por unidade |
| user_id | string (UUID) | ID do usuário |

### movimentacoes_estoque
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | string (UUID) | Chave primária |
| produto_id | string (UUID) | FK → produtos.id |
| tipo | enum | entrada, saida |
| quantidade | number | Quantidade movimentada |
| observacao | string | Observação |
| user_id | string (UUID) | ID do usuário |
| data | timestamp | Data da movimentação |

## Integração Firebase

```javascript
// Exemplo de estrutura no Firestore
/firestore/washwizard
  /users/{userId}
    /clientes/{clienteId}
    /veiculos/{veiculoId}
    /lavagens/{lavagemId}
    /produtos/{produtoId}
    /movimentacoes/{movimentacaoId}
  /tipos_lavagem/{tipoId}  // global (compartilhado)
```

## Integração Supabase

```sql
-- Exemplo de tabelas no PostgreSQL
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  modelo VARCHAR(100) NOT NULL,
  placa VARCHAR(10) NOT NULL,
  cor VARCHAR(30),
  user_id UUID REFERENCES auth.users(id)
);

-- Adicionar Foreign Keys em lavagens e movimentacoes
```
