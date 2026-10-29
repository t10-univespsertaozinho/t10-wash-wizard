-- Wash Wizard - schema PostgreSQL (Supabase)
--
-- Equivalente ao schema provisionado no Supabase, com duas diferenças
-- deliberadas:
--   * `id` usa `gen_random_uuid()` (core desde o PG 13) em vez de
--     `uuid_generate_v4()` (extensão uuid-ossp), para um banco descartável
--     subir sem extensões. O backend sempre envia o id, então o default é só
--     conveniência.
--   * `auditoria_lavagens` aceita também as colunas legadas do app
--     (`campo`, `valor_anterior`, `valor_novo`), adicionadas pela migração
--     `migrations/001_auditoria_lavagens_compat.sql` no banco provisionado.
--
-- É idempotente: `npm run db:schema` pode rodar em banco novo ou existente.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tipos_lavagem (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC NOT NULL CHECK (preco >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  data_nascimento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS veiculos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  modelo TEXT NOT NULL,
  placa TEXT NOT NULL,
  cor TEXT,
  marca TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  estoque_minimo NUMERIC NOT NULL DEFAULT 5 CHECK (estoque_minimo >= 0),
  categoria TEXT NOT NULL DEFAULT 'Outros',
  unidade TEXT NOT NULL DEFAULT 'un',
  preco_unitario NUMERIC NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lavagens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo_lavagem_id TEXT NOT NULL REFERENCES tipos_lavagem(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_progresso', 'concluida', 'cancelada')),
  valor NUMERIC NOT NULL CHECK (valor >= 0),
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  pagamento TEXT DEFAULT 'Pendente',
  observacao TEXT,
  data_conclusao TIMESTAMPTZ,
  CONSTRAINT ck_lavagens_concluida_pagamento_definido CHECK (
    status <> 'concluida' OR (
      pagamento IS NOT NULL AND BTRIM(pagamento) <> '' AND LOWER(BTRIM(pagamento)) <> 'pendente'
    )
  )
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  observacao TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trilha de auditoria append-only. `lavagem_id` NÃO tem FK para lavagens de
-- propósito: a prova da exclusão precisa sobreviver à exclusão da lavagem.
-- As colunas `acao`/`dados_anteriores`/`dados_novos` vieram do schema
-- provisionado; `campo`/`valor_anterior`/`valor_novo` são o formato consumido
-- pela API de backup e pelos testes (ver migrations/001).
CREATE TABLE IF NOT EXISTS auditoria_lavagens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lavagem_id TEXT,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  campo TEXT,
  valor_anterior TEXT,
  valor_novo TEXT
);

CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_cliente_id ON veiculos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_user_id ON veiculos(user_id);
CREATE INDEX IF NOT EXISTS idx_produtos_user_id ON produtos(user_id);
CREATE INDEX IF NOT EXISTS idx_lavagens_cliente_id ON lavagens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_lavagens_veiculo_id ON lavagens(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_lavagens_tipo_lavagem_id ON lavagens(tipo_lavagem_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_id ON movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_lavagens_lavagem_id ON auditoria_lavagens(lavagem_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_lavagens_user_id ON auditoria_lavagens(user_id);
