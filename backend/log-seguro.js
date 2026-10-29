/**
 * Sanitização de erro para log (LGPD, Art. 6º, VII e VIII).
 *
 * Logar o objeto de erro inteiro é o caminho mais curto para dado pessoal
 * aparecer no log do Render. O `DatabaseError` do `pg` carrega campos que
 * embutem o VALOR da linha que falhou — `detail` de uma violação de unicidade
 * vem como `Key (email)=(joao@exemplo.com) already exists`, e `where` traz o
 * contexto da query. Esses campos não entram no log.
 *
 * O que fica é o suficiente para diagnosticar: `message` do `pg` nomeia a
 * constraint violada, nunca o valor ("duplicate key value violates unique
 * constraint \"users_email_key\""), e `code`/`constraint`/`table`/`column`
 * identificam exatamente onde quebrou.
 *
 * Vive em módulo próprio porque `server.js` e `middleware/auth.js` usam o mesmo
 * helper, e `server.js` importa o middleware — um helper no servidor criaria um
 * ciclo de import.
 */

// Campos do DatabaseError do `pg` que podem conter valor de linha ou o texto da
// query. Listados aqui para documentar o que está sendo descartado de propósito.
export const CAMPOS_SENSIVEIS_PG = ['detail', 'where', 'query', 'internalQuery', 'parameters'];

const CAMPOS_DIAGNOSTICOS = ['name', 'message', 'code', 'constraint', 'table', 'column', 'routine', 'schema'];

export function sanitizarErroParaLog(err) {
  if (!err || typeof err !== 'object') {
    return { message: String(err) };
  }

  const seguro = {};
  for (const campo of CAMPOS_DIAGNOSTICOS) {
    if (err[campo] !== undefined && err[campo] !== null) seguro[campo] = err[campo];
  }
  // O stack é código do servidor, não dado do usuário — e é o que permite achar
  // a linha que lançou.
  if (err.stack) seguro.stack = err.stack;

  return seguro;
}

export default sanitizarErroParaLog;
