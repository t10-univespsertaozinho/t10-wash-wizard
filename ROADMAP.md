# Wash Wizard — Roadmap

> **Última atualização:** 2026-09-21
> Ponteiro de planejamento técnico. Para o estado atual da arquitetura, veja `README.md` e `AGENTS.md`. Para o histórico de mudanças, veja `HISTORY.md`.

## Onde estamos

A base operacional (CRUD de clientes/veículos/lavagens/estoque, autenticação JWT, RBAC, backup CSV) está estável e documentada em `README.md` e `SECURITY.md`. A próxima fase do projeto desloca o foco de "registrar operações" para "extrair valor dos dados operacionais já registrados": Data Science e Analytics Avançado sobre o histórico de lavagens, clientes e estoque.

Isso não substitui o sistema transacional (SQLite continua sendo o sistema de registro/OLTP). A camada analítica é aditiva: lê do SQLite, nunca escreve nele.

---

## Fase 1 — Engenharia de Dados (ETL)

Objetivo: transformar as tabelas relacionais do `wash_wizard.db` (otimizadas para transações unitárias) em um formato adequado para consultas analíticas em lote.

- **Extração:** job (script Python ou Node) que lê incrementalmente as tabelas `lavagens`, `clientes`, `veiculos`, `produtos`, `movimentacoes`, `tipos_lavagem` via `sqlite3`/`better-sqlite3`, filtrando por `created_at`/`data` desde a última extração.
- **Transformação:** normalizar tipos (datas ISO 8601 → `datetime64`), resolver chaves estrangeiras em joins denormalizados (ex: lavagem + cliente + veículo + tipo em uma única linha), calcular colunas derivadas (dia da semana, duração do atendimento).
- **Destino (datamart analítico):** duas opções não excludentes, escolher pela necessidade:
  - **Arquivos Parquet particionados** (ex: por mês) para portabilidade e consumo por qualquer ferramenta (pandas, Spark, BI).
  - **DuckDB** (arquivo `.duckdb` único) quando se quiser rodar SQL analítico direto sobre os Parquets ou sobre uma cópia columnar do banco, sem subir infraestrutura adicional — boa opção para o porte deste projeto.
- **Orquestração:** dado o porte do projeto, um script agendado (cron local ou `node-cron`) rodando o pipeline diariamente é suficiente; não há necessidade de Airflow/Dagster nesta fase.
- **Local sugerido no repo:** `analytics/etl/` (pipeline) e `analytics/datamart/` (saída Parquet/DuckDB), como um novo workspace fora de `frontend/` e `backend/`.

## Fase 2 — Análise Exploratória & Métricas-Chave

Métricas a calcular sobre o datamart, com a definição operacional de cada uma:

| Métrica | Definição de cálculo |
|---|---|
| **Churn de clientes** | % de clientes com pelo menos 1 lavagem `concluida` há mais de N dias (ex: 60/90) sem nenhuma lavagem nova desde então. |
| **LTV por cliente** | Soma de `valor` de todas as lavagens `concluida` do cliente, ao longo de todo o histórico. |
| **LTV por veículo** | Mesmo cálculo, agrupado por `veiculo_id` — relevante porque um cliente pode ter vários veículos com padrões de uso distintos. |
| **Tempo médio de atendimento na fila** | Média de `data_conclusao - data` (em minutos/horas) para lavagens `concluida`, segmentável por tipo de lavagem, dia da semana e horário. |
| **Giro de estoque** | Saídas de um produto no período ÷ estoque médio do produto no mesmo período; identifica produtos de alto giro (risco de ruptura) vs. baixo giro (capital parado). |

Entregável desta fase: notebooks (Jupyter) ou um dashboard exploratório (ex: Streamlit/Metabase) consumindo o datamart, sem necessidade de expor isso na aplicação principal ainda.

## Fase 3 — Modelos Preditivos (Machine Learning)

### 3.1 Previsão de Demanda (Séries Temporais)
- **Objetivo:** prever o volume de lavagens por dia/faixa de horário para dimensionar a escala de operadores com antecedência.
- **Dados de entrada:** série histórica de contagem de lavagens (do datamart), features de calendário (dia da semana, feriado, fim de mês) e, opcionalmente, dados climáticos de uma API externa (chuva reduz lavagens externas, por exemplo).
- **Abordagem sugerida:** começar com um baseline simples (média móvel / sazonalidade semanal) antes de modelos mais custosos; evoluir para Prophet ou um regressor de gradient boosting (XGBoost/LightGBM) com as features de calendário e clima caso o baseline não seja suficiente.
- **Métrica de sucesso:** erro percentual (MAPE) na previsão do volume diário, comparado ao baseline.

### 3.2 Gestão Preditiva de Estoque
- **Objetivo:** estimar quando um insumo (shampoo, cera, etc.) vai esgotar, com base nos tipos de lavagem já agendados/históricos, não apenas no consumo médio passado.
- **Abordagem:** mapear o consumo médio de cada produto por tipo de lavagem (a partir de `movimentacoes` cruzado com `lavagens.tipo_lavagem_id`), e projetar o consumo esperado dado o mix de lavagens agendadas/previstas (usando a saída da Fase 3.1). Alertar quando a projeção de estoque cruzar o `estoque_minimo` antes da próxima reposição planejada.
- **Evolução futura:** modelo de regressão para consumo por produto, se a relação tipo-de-lavagem → consumo não for suficientemente linear.

### 3.3 Segmentação de Clientes (RFM)
- **Objetivo:** classificar clientes por Recência, Frequência e Valor Monetário para orientar ações de fidelização (ex: campanha para clientes de alto valor em risco de churn).
- **Abordagem:** calcular os três scores por cliente a partir do datamart (recência = dias desde a última lavagem `concluida`; frequência = nº de lavagens no período; valor = LTV da Fase 2), segmentar em quintis (RFM clássico) ou usar clusterização (k-means) sobre os três scores normalizados.
- **Saída:** tabela `cliente_segmento_rfm` no datamart, consumível tanto por um dashboard quanto futuramente pela própria aplicação (ex: destacar clientes VIP na tela de detalhe do cliente).

---

## Dependências técnicas sugeridas

- **Extração/transformação:** Python 3.11+, `pandas` ou `polars`, `duckdb` (leitura direta de SQLite via extensão `sqlite_scanner`).
- **Modelagem:** `scikit-learn` (RFM/clusterização), `statsmodels` ou `prophet` (séries temporais), `xgboost`/`lightgbm` (se o baseline de séries temporais não bastar).
- **Ambiente:** isolar em `analytics/requirements.txt` (ou `pyproject.toml`) próprio, separado das dependências Node do `frontend`/`backend`.

## Sequenciamento sugerido

1. Fase 1 (ETL) é pré-requisito para todo o resto — sem datamart confiável, as métricas e modelos ficam refazendo o mesmo trabalho de extração repetidamente.
2. Fase 2 (métricas exploratórias) valida que os dados fazem sentido e já entrega valor sozinha (visibilidade para o dono do negócio) antes de qualquer modelo.
3. Fase 3 é iterativa por sub-item: RFM (3.3) é o mais simples e rápido de entregar primeiro; previsão de demanda (3.1) e estoque preditivo (3.2) dependem de mais histórico acumulado para validação e podem vir depois.

## Fora de escopo por ora

- Servir os modelos em produção (API de inferência) — nesta fase o objetivo é gerar insight analítico, não automatizar decisões operacionais.
- Multi-tenancy nos dados — o modelo de dados continua sendo o de um único lava-rápido (ver nota em `backend/server.js` sobre isolamento por usuário).
