/**
 * Credenciais de bootstrap usadas exclusivamente por `seed.js` (FA-17).
 *
 * Por que este módulo existe separado do `config.js`:
 * o servidor de API (`server.js`) importa `config.js` no boot. Antes, as senhas
 * de seed eram resolvidas e validadas no topo do `config.js`, então um serviço
 * web em produção (ex.: Render) **não subia** se `SEED_ADMIN_PASSWORD` ou
 * `SEED_OPERADOR_PASSWORD` não estivessem definidas — mesmo que o seed nunca
 * fosse executado. Senhas de povoamento não são requisito de runtime da API.
 *
 * Aqui a validação é sob demanda: importar este módulo nunca lança. A falha
 * acontece só quando `resolverSenhaSeed()` é chamada, ou seja, quando o seed
 * roda de fato. O aviso de boot (`avisarSenhasSeedPadrao`) continua disponível
 * para o `server.js` e é puramente informativo.
 */

// As senhas padrão estão no README e no .env.example, ou seja, são públicas.
// Uma instalação que nunca configurou o ambiente fica com credenciais de admin
// conhecidas por qualquer pessoa — e nada no boot avisava sobre isso.
export const SENHAS_SEED_PADRAO = {
  SEED_ADMIN_PASSWORD: 'admin123',
  SEED_OPERADOR_PASSWORD: 'operador123',
};

function ehProducao() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Resolve a senha de seed, validando apenas quando o seed é executado.
 *
 * Em produção, senha ausente ou igual ao padrão publicado é fatal: é melhor o
 * seed não rodar do que criar um administrador com credencial de documentação.
 * Em desenvolvimento/teste, cai no padrão para manter a facilidade de uso.
 */
export function resolverSenhaSeed(variavel) {
  const padrao = SENHAS_SEED_PADRAO[variavel];
  if (!padrao) {
    throw new Error(
      `Senha de seed desconhecida: ${variavel}. ` +
      `Variáveis suportadas: ${Object.keys(SENHAS_SEED_PADRAO).join(', ')}.`
    );
  }

  const doAmbiente = process.env[variavel];
  if (doAmbiente && doAmbiente !== padrao) return doAmbiente;

  if (ehProducao()) {
    throw new Error(
      `${variavel} ${doAmbiente ? 'ainda é a senha padrão da documentação' : 'não está definida'}. ` +
      'Defina uma senha própria nas variáveis de ambiente antes de rodar o seed ' +
      `em produção (no Render: Environment → ${variavel}).`
    );
  }

  return padrao;
}

/**
 * Aviso de boot (não fatal) quando alguma senha de seed continua com o padrão
 * publicado. Em produção o próprio `resolverSenhaSeed` barra o seed, então o
 * aviso é restrito a desenvolvimento para não sugerir `npm run seed` (que é
 * destrutivo) em um ambiente real.
 */
export function avisarSenhasSeedPadrao() {
  const padrao = Object.entries(SENHAS_SEED_PADRAO)
    .filter(([variavel, valor]) => (process.env[variavel] || valor) === valor)
    .map(([variavel]) => variavel);

  if (padrao.length === 0 || ehProducao()) return;

  console.warn(
    `AVISO (desenvolvimento): ${padrao.join(' e ')} ainda usa(m) a senha padrão da ` +
    'documentação (admin123/operador123). Qualquer pessoa com acesso à rede pode ' +
    'entrar como administrador. Defina senhas próprias em backend/.env e rode ' +
    '`npm run seed` novamente antes de usar o sistema em campo.'
  );
}
