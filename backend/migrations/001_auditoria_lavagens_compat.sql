-- Compatibilidade entre o schema provisionado no Supabase e o app.
--
-- O banco provisionado criou auditoria_lavagens com:
--   id, lavagem_id, acao, dados_anteriores, dados_novos, user_id, data
-- O backend (e o backup CSV) sempre trabalharam com:
--   campo, valor_anterior, valor_novo
--
-- Esta migração é ADITIVA: não remove nem renomeia nada do schema existente.
-- O app passa a gravar os dois formatos, então consultas antigas continuam
-- funcionando e o export/import mantém o contrato atual.
--
-- Idempotente: pode rodar mais de uma vez.

ALTER TABLE auditoria_lavagens ADD COLUMN IF NOT EXISTS campo TEXT;
ALTER TABLE auditoria_lavagens ADD COLUMN IF NOT EXISTS valor_anterior TEXT;
ALTER TABLE auditoria_lavagens ADD COLUMN IF NOT EXISTS valor_novo TEXT;

-- Índices de FK que o schema provisionado não criou. Sem eles, exclusões em
-- cascata e consultas do dashboard fazem full scan nas tabelas filhas.
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
