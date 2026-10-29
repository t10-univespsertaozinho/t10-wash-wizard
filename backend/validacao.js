/**
 * Validação de entrada na borda da API, com Zod.
 *
 * Por que uma camada nova, se os handlers já validavam: os validadores
 * existentes (`textoObrigatorio`, `numeroNaoNegativo`, `placaValida`) rodam
 * DENTRO do handler, campo a campo, depois de o corpo inteiro já ter sido
 * aceito. Eles cobrem bem o campo que olham, mas nada olhava o corpo como um
 * todo — então uma propriedade inesperada entrava, e uma string de 1 MB em um
 * campo opcional era truncada em silêncio em vez de recusada.
 *
 * O schema resolve as duas coisas de uma vez: descarta o que não foi declarado
 * e recusa o que está fora de faixa, antes de o handler rodar. Os validadores
 * internos continuam no lugar — é a defesa em profundidade que a SECURITY.md
 * descreve, e são eles que produzem as mensagens específicas de campo que a
 * suíte já cobre.
 *
 * Decisões de compatibilidade, todas verificadas contra a base real:
 *
 *  - **Strip, não strict.** O frontend envia `user_id` no corpo de todo POST
 *    (`frontend/src/services/database.ts`). Com `.strict()` a API passaria a
 *    responder 400 em cada cadastro. O Zod descarta o campo desconhecido, que
 *    é também o comportamento seguro: nenhuma rota confia em `user_id` do
 *    corpo — toda gravação usa `req.user.id` do token.
 *
 *  - **`status` da lavagem fica fora do schema.** O handler já recusa status
 *    fora do domínio com uma mensagem própria, coberta por
 *    `test/integridade-lavagens.test.js`. Movê-lo para cá trocaria aquela
 *    mensagem por "Dados inválidos" e quebraria o contrato de erro.
 *
 *  - **`pagamento` é enum dos valores reais** (`PIX`, `Débito`, `Crédito`,
 *    `Dinheiro`, `Pendente`) — exatamente o que a UI oferece em
 *    `ConcluirLavagemDialog.tsx` e `NovaLavagemModal.tsx`, e o que as 193
 *    linhas em produção contêm. Um enum em snake_case recusaria todas elas.
 *
 *  - **Login valida só presença.** Formato de e-mail aqui devolveria 400 para
 *    `email: "x"`, e o contrato (incluindo o teste de boot do CI) é 401 para
 *    credencial inválida. Também é melhor assim: um 400 para e-mail malformado
 *    e 401 para senha errada é um oráculo que distingue os dois casos.
 *
 *  - **Nenhuma mensagem ecoa o valor recebido.** Um `detalhes` com o conteúdo
 *    do campo devolveria dado pessoal ao cliente e o colocaria no log de quem
 *    registra respostas 4xx.
 */
import { z } from 'zod';

// ==========================================
// PRIMITIVAS DE TEXTO
// ==========================================

/**
 * Normaliza e remove caracteres de controle, SEM truncar.
 *
 * Não escapa HTML: o React escapa na renderização, e escapar aqui causaria
 * double-encoding no banco (ver SECURITY.md, 5.3).
 */
export const sanitizarTexto = (valor) =>
  String(valor).normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim();

/**
 * Sanitiza e corta no limite. Mantida com a semântica original porque os
 * handlers do `server.js` dependem dela em campos que não passam por schema.
 */
export const limparTexto = (valor, max = 200) => {
  if (valor === undefined || valor === null) return null;
  return sanitizarTexto(valor).slice(0, max);
};

/**
 * Texto sanitizado e com faixa de tamanho verificada.
 *
 * A sanitização acontece ANTES da medição, e o limite recusa em vez de cortar:
 * truncar em silêncio aceitaria um payload de 1 MB como se fosse válido, que é
 * exatamente o abuso que esta camada existe para barrar.
 */
const textoLimitado = (campo, { min = 1, max }) =>
  z.string({ error: `${campo} deve ser um texto.` })
    .transform(sanitizarTexto)
    .pipe(
      z.string()
        .min(min, min === 1 ? `${campo} é obrigatório.` : `${campo} deve ter no mínimo ${min} caracteres.`)
        .max(max, `${campo} deve ter no máximo ${max} caracteres.`)
    );

// Campo de texto opcional: ausente, nulo e string vazia são todos "não
// informado" e viram null. A UI envia "" quando o usuário limpa o campo.
const textoOpcional = (campo, max) =>
  z.union([
    z.literal('').transform(() => null),
    z.null(),
    textoLimitado(campo, { min: 1, max }),
  ]).optional();

// Número aceito como number ou string numérica (inputs HTML enviam string),
// espelhando o `Number(valor)` que os handlers já faziam.
const numeroNaoNegativo = (campo) =>
  z.coerce.number({ error: `${campo} deve ser um número.` })
    .refine(Number.isFinite, { message: `${campo} deve ser um número.` })
    .min(0, `${campo} deve ser maior ou igual a zero.`);

// Identificador de relacionamento. A existência da linha é verificada pelo
// handler e pela foreign key; aqui só garantimos que veio um id utilizável.
const idObrigatorio = (campo) => textoLimitado(campo, { min: 1, max: 64 });

// ==========================================
// DOMÍNIOS
// ==========================================

// Formatos aceitos: antigo AAA1234, Mercosul AAA1A23 e o de 8 caracteres que o
// frontend valida hoje (usePlacaMask).
export const RE_PLACA = /^([A-Z]{3}\d{4}|[A-Z]{3}\d[A-Z]\d{2}|[A-Z]{4}\d[A-Z]{2}\d{2})$/;

// Os valores que a UI oferece e que a base já contém. 'Pendente' é o estado
// inicial de uma lavagem não paga — o handler é que decide quando ele deixa de
// ser aceitável (conclusão exige pagamento definido).
export const FORMAS_PAGAMENTO = ['PIX', 'Débito', 'Crédito', 'Dinheiro', 'Pendente'];

// Telefone é guardado formatado — ex: "(11) 98888-7777". A validação é pela
// contagem de dígitos, preservando a máscara que a UI envia.
const telefone = z.union([
  z.literal('').transform(() => null),
  z.null(),
  z.string({ error: 'Telefone deve ser um texto.' })
    .transform(sanitizarTexto)
    .pipe(z.string().max(20, 'Telefone deve ter no máximo 20 caracteres.'))
    .refine((v) => {
      const digitos = v.replace(/\D/g, '');
      return digitos.length >= 10 && digitos.length <= 11;
    }, { message: 'Telefone deve ter 10 ou 11 dígitos (DDD + número).' }),
]).optional();

// 'YYYY-MM-DD' é o formato do input type=date e o que a coluna DATE devolve.
// A checagem de calendário evita que '2026-02-31' chegue ao banco.
const dataNascimento = z.union([
  z.literal('').transform(() => null),
  z.null(),
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato AAAA-MM-DD.')
    .refine((v) => {
      const [ano, mes, dia] = v.split('-').map(Number);
      const d = new Date(Date.UTC(ano, mes - 1, dia));
      return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
    }, { message: 'Data de nascimento inexistente no calendário.' }),
]).optional();

const placa = z.string({ error: 'Placa deve ser um texto.' })
  // Normaliza como o backend sempre gravou: maiúsculas, sem máscara.
  .transform((v) => sanitizarTexto(v).toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .pipe(
    z.string()
      .max(10, 'Placa deve ter no máximo 10 caracteres.')
      .regex(RE_PLACA, 'Placa inválida. Use o formato AAA1234 ou AAA1A23.')
  );

// ==========================================
// SCHEMAS POR ROTA
// ==========================================

export const schemaLogin = z.object({
  email: textoLimitado('E-mail', { min: 1, max: 150 }),
  senha: z.string({ error: 'Senha é obrigatória.' }).min(1, 'Senha é obrigatória.').max(200, 'Senha deve ter no máximo 200 caracteres.'),
});

export const schemaCliente = z.object({
  nome: textoLimitado('Nome do cliente', { min: 2, max: 120 }),
  telefone,
  data_nascimento: dataNascimento,
});

// PUT mantém `nome` obrigatório (o handler sempre o reescreve) e deixa o resto
// opcional, para que uma atualização parcial não apague campo não enviado.
export const schemaClienteAtualizacao = schemaCliente;

export const schemaVeiculo = z.object({
  cliente_id: idObrigatorio('Cliente'),
  modelo: textoLimitado('Modelo', { min: 1, max: 60 }),
  placa,
  marca: textoOpcional('Marca', 60),
  cor: textoOpcional('Cor', 60),
});

// O handler do PUT não reatribui `cliente_id` (um veículo não troca de dono
// por edição), então ele não é exigido aqui.
export const schemaVeiculoAtualizacao = schemaVeiculo.partial({ cliente_id: true });

export const schemaLavagem = z.object({
  cliente_id: idObrigatorio('Cliente'),
  veiculo_id: idObrigatorio('Veículo'),
  tipo_lavagem_id: idObrigatorio('Tipo de lavagem'),
  valor: numeroNaoNegativo('O valor da lavagem'),
  // Fora do schema de propósito: ver nota no topo do arquivo.
  status: z.string().max(20, 'Status deve ter no máximo 20 caracteres.').optional(),
  pagamento: z.enum(FORMAS_PAGAMENTO, {
    error: `Forma de pagamento inválida. Use uma de: ${FORMAS_PAGAMENTO.join(', ')}`,
  }).optional(),
  observacao: textoOpcional('Observação', 500),
});

// Atualização de lavagem é parcial por natureza: o operador avança o status, o
// admin corrige o valor, e o que não veio no corpo não é tocado.
export const schemaLavagemAtualizacao = schemaLavagem.partial();

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Valida `req.body` contra o schema e substitui o corpo pelo resultado —
 * normalizado e sem as propriedades não declaradas.
 *
 * Responde 400 com a lista de problemas por campo. Nenhuma mensagem contém o
 * valor enviado.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body ?? {});

    if (!resultado.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        detalhes: resultado.error.issues.map((problema) => ({
          campo: problema.path.join('.') || '(corpo)',
          mensagem: problema.message,
        })),
      });
    }

    req.body = resultado.data;
    next();
  };
}
