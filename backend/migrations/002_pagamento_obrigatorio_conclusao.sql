-- Uma lavagem concluída sempre precisa ter um meio de pagamento definido.
-- Legados sem meio de pagamento são normalizados para Dinheiro antes do CHECK.
-- Canceladas e lavagens ainda abertas continuam aceitando Pendente.

UPDATE lavagens
SET pagamento = 'Dinheiro'
WHERE status = 'concluida'
  AND (pagamento IS NULL OR BTRIM(pagamento) = '' OR LOWER(BTRIM(pagamento)) = 'pendente');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_lavagens_concluida_pagamento_definido'
      AND conrelid = 'lavagens'::regclass
  ) THEN
    ALTER TABLE lavagens
      ADD CONSTRAINT ck_lavagens_concluida_pagamento_definido
      CHECK (
        status <> 'concluida' OR (
          pagamento IS NOT NULL AND BTRIM(pagamento) <> '' AND LOWER(BTRIM(pagamento)) <> 'pendente'
        )
      );
  END IF;
END;
$$;
