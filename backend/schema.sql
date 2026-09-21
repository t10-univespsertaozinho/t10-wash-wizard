-- Wash Wizard - SQLite Schema
-- Adaptado do schema original em PostgreSQL (tabela_sistema.sql) para SQLite:
--   * uuid -> TEXT
--   * timestamps com timezone -> TEXT (ISO 8601)
--   * restrições nativas do Postgres -> CHECK constraints

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tipos_lavagem (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco REAL NOT NULL CHECK (preco >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS veiculos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  modelo TEXT NOT NULL,
  placa TEXT NOT NULL,
  cor TEXT,
  marca TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  estoque_minimo REAL NOT NULL DEFAULT 5 CHECK (estoque_minimo >= 0),
  categoria TEXT NOT NULL DEFAULT 'Outros',
  unidade TEXT NOT NULL DEFAULT 'un',
  preco_unitario REAL NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS lavagens (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo_lavagem_id TEXT NOT NULL REFERENCES tipos_lavagem(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_progresso', 'concluida', 'cancelada')),
  valor REAL NOT NULL CHECK (valor >= 0),
  data TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  pagamento TEXT DEFAULT 'Pendente',
  observacao TEXT,
  data_conclusao TEXT
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id TEXT PRIMARY KEY,
  produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade REAL NOT NULL CHECK (quantidade > 0),
  observacao TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  data TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_cliente_id ON veiculos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_user_id ON veiculos(user_id);
CREATE INDEX IF NOT EXISTS idx_produtos_user_id ON produtos(user_id);
CREATE INDEX IF NOT EXISTS idx_lavagens_cliente_id ON lavagens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_lavagens_veiculo_id ON lavagens(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_lavagens_tipo_lavagem_id ON lavagens(tipo_lavagem_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_id ON movimentacoes(produto_id);
