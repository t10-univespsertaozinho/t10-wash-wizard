/**
 * Camada de acesso ao PostgreSQL (Supabase).
 *
 * O restante do backend foi escrito para o driver `sqlite3`: placeholders `?`,
 * callbacks e uma única conexão implícita. Em vez de reescrever todas as rotas,
 * este módulo expõe a mesma interface Promise-based (`query/get/all/run/exec`)
 * sobre um `Pool` do `pg`, convertendo `?` para `$1, $2, ...` de forma
 * determinística (sem tocar em `?` dentro de strings, comentários ou
 * dollar-quoted blocks).
 *
 * Transações exigem uma conexão dedicada — com Pool, `BEGIN` e `COMMIT` podem
 * cair em conexões diferentes. Por isso existe `withTransaction`, e as rotas
 * que precisam de atomicidade usam os helpers do `tx`.
 */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool, types } = pg;

// ==========================================
// TYPE PARSERS
// ==========================================
// O `pg` devolve NUMERIC/DECIMAL como string para não perder precisão. A API e
// o React esperam números (`valor.toFixed`, somas, gráficos), então os tipos
// monetários e contadores são convertidos na borda do banco.
// OID 1700 = NUMERIC/DECIMAL; OID 20 = BIGINT/INT8 (COUNT(*)).
types.setTypeParser(1700, (valor) => (valor === null ? null : parseFloat(valor)));
types.setTypeParser(20, (valor) => (valor === null ? null : parseInt(valor, 10)));

// Timestamps: o driver entrega o texto no formato do PostgreSQL
// ('2026-10-28 15:28:32.123+00'). O JavaScript NÃO aceita esse offset curto
// quando há 'T' no meio ('...+00' vira Invalid Date), então normalizamos o
// separador e completamos o offset antes de converter. Valor inesperado é
// devolvido como veio, em vez de derrubar a serialização da linha inteira.
function paraIsoUtc(valor, comTimezone) {
  if (valor === null) return null;
  let texto = valor.replace(' ', 'T');
  if (comTimezone) {
    texto = texto.replace(/([+-]\d{2})(\d{2})$/, '$1:$2').replace(/([+-]\d{2})$/, '$1:00');
  } else {
    texto = `${texto}Z`;
  }
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? valor : data.toISOString();
}

// TIMESTAMPTZ. O SQLite devolvia ISO 8601 em TEXT e o frontend/API dependem
// desse formato (`new Date(l.data)`); o parser padrão do pg devolve `Date`, que
// ao virar CSV muda de formato. Normalizamos para ISO UTC na saída.
types.setTypeParser(1184, (valor) => paraIsoUtc(valor, true));
// TIMESTAMP sem timezone: o schema não usa, mas tratamos como UTC por coerência.
types.setTypeParser(1114, (valor) => paraIsoUtc(valor, false));

// DATE (OID 1082). O parser padrão devolve um `Date` à meia-noite local, mas o
// contrato da API e o formulário do frontend esperam a string 'YYYY-MM-DD'
// (data_nascimento). Devolver o texto cru preserva o contrato e evita o
// clássico deslocamento de um dia ao serializar para JSON/CSV.
types.setTypeParser(1082, (valor) => valor);

// ==========================================
// CONEXÃO
// ==========================================
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL não definida. Configure a string de conexão do PostgreSQL ' +
    '(Supabase) nas variáveis de ambiente do serviço (no Render: Environment → ' +
    'DATABASE_URL) ou em backend/.env para desenvolvimento local.'
  );
}

let url;
try {
  url = new URL(connectionString);
} catch {
  throw new Error(
    'DATABASE_URL inválida. Use o formato ' +
    'postgresql://USUARIO:SENHA@HOST:PORTA/BANCO (a senha deve estar codificada ' +
    'como URL, ex.: @ → %40).'
  );
}

const hostLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

// Supabase exige SSL. Um PostgreSQL local de testes normalmente não oferece
// SSL, então `localhost` (ou PGSSLMODE=disable) desliga a negociação.
//
// No Render, o host do Supabase é remoto e o TLS entra automaticamente. Também
// respeitamos `?sslmode=` na própria connection string, porque ele é o formato
// que o painel do Supabase/Render costuma fornecer: `disable` desliga, e
// `require`/`verify-ca`/`verify-full` forçam TLS mesmo em host local.
const sslMode = (process.env.PGSSLMODE || url.searchParams.get('sslmode') || '').toLowerCase();
const sslDesabilitado = sslMode === 'disable';
const sslExigido = ['require', 'verify-ca', 'verify-full'].includes(sslMode);
// rejectUnauthorized: false porque a CA do pooler do Supabase não está no trust
// store padrão do Node. O tráfego continua cifrado; a identidade do servidor é
// validada pelo hostname do provedor, não pela cadeia local.
const usaIssl = !sslDesabilitado && (sslExigido || !hostLocal);

export const pool = new Pool({
  connectionString,
  ssl: usaIssl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX) || 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'wash-wizard-backend',
});

// Um erro em conexão ociosa (ex: pooler derrubou a sessão) não pode virar
// unhandled 'error' e derrubar o processo.
pool.on('error', (err) => {
  console.error('Erro inesperado em conexão ociosa do PostgreSQL:', err.message);
});

// ==========================================
// PLACEHOLDERS
// ==========================================
/**
 * Converte `?` posicionais (estilo SQLite) para `$1, $2, ...` (PostgreSQL).
 *
 * O scanner ignora `?` dentro de:
 *  - strings '...' (com escape '' ) e identificadores "..."
 *  - comentários -- e /* ... *\/
 *  - blocos dollar-quoted $$...$$ / $tag$...$tag$
 *
 * Sem isso, um `?` legítimo dentro de um literal seria renumerado e a query
 * quebraria de forma silenciosa.
 */
export function paraPlaceholdersPostgres(sql) {
  let saida = '';
  let indice = 0;
  let parametros = 0;
  let estado = 'normal';
  let dollarTag = null;

  while (indice < sql.length) {
    const char = sql[indice];
    const proximo = sql[indice + 1];

    if (estado === 'normal') {
      if (char === "'") {
        estado = 'string';
        saida += char;
        indice++;
      } else if (char === '"') {
        estado = 'identificador';
        saida += char;
        indice++;
      } else if (char === '-' && proximo === '-') {
        estado = 'comentarioLinha';
        saida += '--';
        indice += 2;
      } else if (char === '/' && proximo === '*') {
        estado = 'comentarioBloco';
        saida += '/*';
        indice += 2;
      } else if (char === '$') {
        const restante = sql.slice(indice);
        const match = restante.match(/^\$[A-Za-z_0-9]*\$/);
        if (match) {
          dollarTag = match[0];
          estado = 'dollar';
          saida += dollarTag;
          indice += dollarTag.length;
        } else {
          saida += char;
          indice++;
        }
      } else if (char === '?') {
        saida += `$${++parametros}`;
        indice++;
      } else {
        saida += char;
        indice++;
      }
      continue;
    }

    if (estado === 'string') {
      saida += char;
      if (char === "'") {
        if (proximo === "'") {
          saida += proximo;
          indice += 2;
          continue;
        }
        estado = 'normal';
      }
      indice++;
      continue;
    }

    if (estado === 'identificador') {
      saida += char;
      if (char === '"') {
        if (proximo === '"') {
          saida += proximo;
          indice += 2;
          continue;
        }
        estado = 'normal';
      }
      indice++;
      continue;
    }

    if (estado === 'comentarioLinha') {
      saida += char;
      if (char === '\n') estado = 'normal';
      indice++;
      continue;
    }

    if (estado === 'comentarioBloco') {
      saida += char;
      if (char === '*' && proximo === '/') {
        saida += '/';
        indice += 2;
        estado = 'normal';
        continue;
      }
      indice++;
      continue;
    }

    if (estado === 'dollar') {
      if (sql.startsWith(dollarTag, indice)) {
        saida += dollarTag;
        indice += dollarTag.length;
        estado = 'normal';
        dollarTag = null;
        continue;
      }
      saida += char;
      indice++;
    }
  }

  return saida;
}

// ==========================================
// COMPATIBILIDADE SQLite -> PostgreSQL
// ==========================================
export const query = async (text, params = []) => {
  return pool.query(paraPlaceholdersPostgres(text), params);
};

export const get = async (text, params = []) => {
  const resultado = await query(text, params);
  return resultado.rows[0];
};

export const all = async (text, params = []) => {
  const resultado = await query(text, params);
  return resultado.rows;
};

/**
 * Espelha o `db.run` do sqlite3: `{ changes, lastID }`.
 *
 * `lastID` não existe no PostgreSQL. Quando a query usa `RETURNING id`, ele é
 * extraído da primeira linha; caso contrário fica `null`. Nenhuma rota atual
 * depende de `lastID` (o backend sempre gera o id com `crypto.randomUUID`).
 */
export const run = async (text, params = []) => {
  const sql = paraPlaceholdersPostgres(text);
  const resultado = await pool.query(sql, params);
  return {
    changes: resultado.rowCount ?? 0,
    lastID: resultado.rows?.[0]?.id ?? null,
  };
};

/**
 * Executa SQL puro (DDL, scripts com múltiplos statements, TRUNCATE).
 * Sem parâmetros o `pg` usa o protocolo simples, que aceita vários comandos.
 */
export const exec = async (text) => {
  await pool.query(text);
};

/**
 * Executa `tarefa` dentro de uma transação em uma única conexão do pool.
 * Os helpers recebidos usam o mesmo client, portanto BEGIN/COMMIT/ROLLBACK
 * valem para todas as queries da tarefa.
 */
export async function withTransaction(tarefa) {
  const client = await pool.connect();
  const tx = {
    query: (text, params = []) => client.query(paraPlaceholdersPostgres(text), params),
    get: async (text, params = []) => (await tx.query(text, params)).rows[0],
    all: async (text, params = []) => (await tx.query(text, params)).rows,
    run: async (text, params = []) => {
      const resultado = await tx.query(text, params);
      return {
        changes: resultado.rowCount ?? 0,
        lastID: resultado.rows?.[0]?.id ?? null,
      };
    },
    exec: async (text) => client.query(text),
  };

  try {
    await client.query('BEGIN');
    const resultado = await tarefa(tx);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Se o ROLLBACK falhar (conexão morta), o erro original é o relevante.
    }
    throw err;
  } finally {
    client.release();
  }
}

// `dbReady` só resolve depois de um SELECT 1 real: o servidor não deve abrir a
// porta anunciando sucesso antes de o pooler do Supabase aceitar a conexão.
export const dbReady = (async () => {
  try {
    await pool.query('SELECT 1;');
    console.log('Conectado ao banco de dados PostgreSQL.');
  } catch (err) {
    console.error('Erro ao conectar ao PostgreSQL:', err.message);
    throw err;
  }
})();

export default { query, get, all, run, exec, withTransaction, pool };
