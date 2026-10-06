import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { dbReady, get, all, run, exec } from './db.js';
import { JWT_SECRET, JWT_EXPIRES_IN, JWT_ALGORITHM } from './config.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';

dotenv.config();

const app = express();

const isDev = process.env.NODE_ENV !== 'production';
const isProd = process.env.NODE_ENV === 'production';
const localOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Tabelas e colunas usadas pelas rotas de backup. Declaradas aqui no topo
// porque o fileFilter do multer precisa da allowlist de tabelas.
// auditoria_lavagens entra na lista de propósito: ela é uma tabela de dados
// como as demais, e ficar fora quebrava dois controles ao mesmo tempo — o
// reset a deixava viva com referências órfãs para lavagens apagadas, e o
// export a deixava de fora, perdendo a trilha de auditoria a cada restore.
const tables = ['users', 'clientes', 'veiculos', 'tipos_lavagem', 'lavagens', 'produtos', 'movimentacoes', 'auditoria_lavagens'];

// Erro de origem bloqueada, com status próprio para o error handler devolver
// 403 limpo em vez de cair no handler default do Express (que responderia 500
// com stack trace fora de produção).
class CorsError extends Error {
  constructor(origin) {
    super(`Bloqueado pelo CORS: ${origin}`);
    this.name = 'CorsError';
    this.status = 403;
    this.clientMessage = 'Origem não permitida.';
  }
}

class UploadRejeitado extends Error {
  constructor(nomeArquivo) {
    super(`Arquivo não permitido no backup: ${nomeArquivo}`);
    this.name = 'UploadRejeitado';
    this.status = 400;
    this.clientMessage = `Arquivo não permitido: ${nomeArquivo}. Envie apenas os CSVs gerados pelo export.`;
  }
}

// FRONTEND_URL é obrigatório em produção: sem ele a política de CORS cairia
// silenciosamente para localhost e o deploy pareceria uma falha de rede.
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || (isProd ? null : 'http://localhost:8080');
if (isProd && !FRONTEND_ORIGIN) {
  throw new Error('FRONTEND_URL é obrigatório em produção para definir a política de CORS.');
}

// Confia no primeiro proxy (nginx, Vercel) para que o rate limit enxergue o IP
// real do cliente — sem isso todos os usuários dividem o mesmo contador.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Headers de segurança: anti-clickjacking, anti-MIME-sniffing e CSP restritiva.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // O Recharts injeta um <style> dinâmico (frontend/src/components/ui/chart.tsx),
      // cujos valores passam por uma allowlist de cores no próprio componente.
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", FRONTEND_ORIGIN].filter(Boolean),
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
}));
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));

app.use(cors({
  origin: (origin, callback) => {
    // Requisição sem header Origin: same-origin, proxy do Vite e ferramentas
    // locais. Bloqueada em produção para fechar o vetor de CSRF caso o token
    // venha a migrar para cookie.
    if (!origin) return callback(null, !isProd);

    if (isDev && localOriginRegex.test(origin)) {
      return callback(null, true);
    }
    if (origin === FRONTEND_ORIGIN) {
      return callback(null, true);
    }

    return callback(new CorsError(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Limite explícito de corpo: evita que um payload grande consuma memória do
// processo antes de qualquer validação.
app.use(express.json({ limit: '200kb' }));

// Teto geral de requisições por IP, para que nenhum cliente monopolize o
// event loop single-threaded do Node.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' },
});

// Limite estrito no login: sem ele o único freio contra força bruta seria o
// custo do bcrypt (~80ms), o que permite milhares de tentativas por minuto.
// skipSuccessfulRequests garante que o uso legítimo não consuma a cota.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

app.use('/api', apiLimiter);

// Nota sobre isolamento por usuário: este é um sistema de um único lava-rápido,
// não multi-tenant. Toda a equipe autenticada (admin e operadores) compartilha
// intencionalmente a mesma base de clientes/veículos/lavagens/produtos — por
// isso as rotas GET não filtram por user_id. O que É garantido é que nenhuma
// rota confia em um user_id vindo do cliente: toda gravação usa req.user.id,
// extraído do token JWT validado pelo middleware requireAuth.

// memoryStorage sem limites permitiria que um único upload carregasse
// gigabytes na RAM e derrubasse o processo por OOM.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,   // 5 MB por CSV
    files: tables.length,        // no máximo um arquivo por tabela
    fields: 0,                   // nenhum campo de texto é esperado
  },
  fileFilter: (req, file, cb) => {
    const nome = file.originalname || '';
    const base = path.basename(nome, path.extname(nome));
    if (!nome.toLowerCase().endsWith('.csv') || !tables.includes(base)) {
      return cb(new UploadRejeitado(nome));
    }
    cb(null, true);
  },
});

const genId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

const publicUserFields = 'id, email, nome, role, created_at';
const ROLES_VALIDOS = ['admin', 'operador'];

// Loga o erro real no servidor, mas nunca expõe detalhes internos (ex: mensagens do SQLite) ao cliente.
function handleServerError(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ==========================================
// VALIDAÇÃO DE ENTRADA
// O schema SQLite tem CHECK constraints que garantem a integridade, mas uma
// violação lá estoura como exceção e viraria um 500 genérico. Validar aqui
// devolve 400 com mensagem útil e mantém os logs limpos para detectar ataque real.
// ==========================================

// Erro de validação: carrega status e mensagem seguros para o cliente.
class ValidacaoError extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.name = 'ValidacaoError';
    this.status = status;
    this.clientMessage = mensagem;
  }
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Formatos aceitos de placa, alinhados ao que a UI já produz (usePlacaMask):
// antigo AAA1234, Mercosul AAA1A23, e o formato de 8 caracteres que o
// frontend valida hoje (AAAA1AA11).
const RE_PLACA = /^([A-Z]{3}\d{4}|[A-Z]{3}\d[A-Z]\d{2}|[A-Z]{4}\d[A-Z]{2}\d{2})$/;

const SENHA_MINIMA = 10;

// Remove caracteres de controle e limita o tamanho. Não escapa HTML: o React
// já escapa na renderização, e escapar aqui causaria double-encoding no banco.
const limparTexto = (valor, max = 200) => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return texto.slice(0, max);
};

const textoObrigatorio = (valor, campo, max = 200) => {
  const texto = limparTexto(valor, max);
  if (!texto) throw new ValidacaoError(`${campo} é obrigatório.`);
  return texto;
};

// Aceita ausência quando há padrão; rejeita negativos, NaN e strings não numéricas.
const numeroNaoNegativo = (valor, campo, padrao) => {
  if (valor === undefined || valor === null || valor === '') {
    if (padrao !== undefined) return padrao;
    throw new ValidacaoError(`${campo} é obrigatório.`);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new ValidacaoError(`${campo} deve ser um número maior ou igual a zero.`);
  }
  return numero;
};

// O telefone é armazenado formatado — ex: "(11) 98888-7777". Valida pela
// contagem de dígitos e preserva a formatação que a UI envia.
const telefoneOpcional = (valor) => {
  const texto = limparTexto(valor, 20);
  if (!texto) return null;
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 11) {
    throw new ValidacaoError('Telefone deve ter 10 ou 11 dígitos (DDD + número).');
  }
  return texto;
};

const placaValida = (valor) => {
  const placa = limparTexto(valor, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!RE_PLACA.test(placa)) {
    throw new ValidacaoError('Placa inválida. Use o formato AAA1234 ou AAA1A23.');
  }
  return placa;
};

const emailValido = (valor) => {
  const email = textoObrigatorio(valor, 'E-mail', 120).toLowerCase();
  if (!RE_EMAIL.test(email)) throw new ValidacaoError('E-mail inválido.');
  return email;
};

// Converte ValidacaoError em 400; qualquer outra exceção segue para o 500 genérico.
function responderErro(res, err) {
  if (err instanceof ValidacaoError) {
    return res.status(err.status).json({ error: err.clientMessage });
  }
  return handleServerError(res, err);
}

// Neutraliza gatilhos de fórmula do Excel/LibreOffice/Sheets prefixando a
// célula com apóstrofo. Sem isso, um nome de cliente como =HYPERLINK(...)
// é executado ao abrir o backup, podendo exfiltrar a planilha inteira.
const CSV_GATILHOS_FORMULA = /^[=+\-@\t\r]/;

function sanitizeCsvCell(valor) {
  if (typeof valor !== 'string') return valor;
  return CSV_GATILHOS_FORMULA.test(valor) ? `'${valor}` : valor;
}

// ==========================================
// AUTH API (rotas públicas)
// ==========================================
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await get('SELECT id, email, nome, role, password_hash FROM users WHERE email = ?', [email]);
    const valid = user && await bcrypt.compare(senha, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, algorithm: JWT_ALGORITHM }
    );
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role } });
  } catch (err) { handleServerError(res, err); }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await get(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (err) { handleServerError(res, err); }
});

// A partir daqui, todas as rotas de /api exigem autenticação
app.use('/api', requireAuth);

// ==========================================
// USERS API (somente admin)
// ==========================================
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await all(`SELECT ${publicUserFields} FROM users`);
    res.json(users);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const email = emailValido(req.body.email);
    const nome = textoObrigatorio(req.body.nome, 'Nome', 120);
    const senha = String(req.body.senha || '');
    const role = req.body.role || 'operador';

    if (senha.length < SENHA_MINIMA) {
      throw new ValidacaoError(`A senha deve ter no mínimo ${SENHA_MINIMA} caracteres.`);
    }
    if (!ROLES_VALIDOS.includes(role)) {
      throw new ValidacaoError(`Perfil inválido. Use um dos: ${ROLES_VALIDOS.join(', ')}`);
    }

    const existente = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existente) throw new ValidacaoError('Já existe um usuário com este e-mail.', 409);

    const newId = genId();
    const passwordHash = await bcrypt.hash(senha, 10);
    await run('INSERT INTO users (id, email, nome, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', [newId, email, nome, role, passwordHash, now()]);
    const user = await get(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [newId]);
    res.json(user);
  } catch (err) { responderErro(res, err); }
});

// ==========================================
// CLIENTES API
// ==========================================
app.get('/api/clientes', async (req, res) => {
  try {
    // Retorna todos os clientes (sem filtro por user_id para simplificar)
    const rows = await all('SELECT * FROM clientes', []);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.get('/api/clientes/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const nome = textoObrigatorio(req.body.nome, 'Nome do cliente', 120);
    const telefone = telefoneOpcional(req.body.telefone);
    const id = genId();
    const created_at = now();
    await run('INSERT INTO clientes (id, user_id, nome, telefone, created_at) VALUES (?, ?, ?, ?, ?)', [id, req.user.id, nome, telefone, created_at]);
    const row = await get('SELECT * FROM clientes WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const nome = textoObrigatorio(req.body.nome, 'Nome do cliente', 120);
    const telefone = telefoneOpcional(req.body.telefone);

    const atual = await get('SELECT id FROM clientes WHERE id = ?', [req.params.id]);
    if (!atual) return res.status(404).json({ error: 'Cliente não encontrado' });

    await run('UPDATE clientes SET nome = ?, telefone = ? WHERE id = ?', [nome, telefone, req.params.id]);
    const row = await get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// VEICULOS API
// ==========================================
app.get('/api/veiculos', async (req, res) => {
  try {
    const { cliente_id } = req.query;
    let query = 'SELECT * FROM veiculos';
    let params = [];
    if (cliente_id) { query += ' WHERE cliente_id = ?'; params.push(cliente_id); }
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/veiculos', async (req, res) => {
  try {
    const { cliente_id } = req.body;
    if (!cliente_id) throw new ValidacaoError('Cliente é obrigatório.');

    const modelo = textoObrigatorio(req.body.modelo, 'Modelo', 80);
    const placa = placaValida(req.body.placa);
    const marca = limparTexto(req.body.marca, 60);
    const cor = limparTexto(req.body.cor, 40);

    const cliente = await get('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
    if (!cliente) throw new ValidacaoError('Cliente não encontrado.', 404);

    const id = genId();
    await run('INSERT INTO veiculos (id, cliente_id, user_id, placa, marca, cor, modelo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, cliente_id, req.user.id, placa, marca, cor, modelo, now()]);
    const row = await get('SELECT * FROM veiculos WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.delete('/api/veiculos/:id', async (req, res) => {
  try {
    await run('DELETE FROM veiculos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

app.put('/api/veiculos/:id', async (req, res) => {
  try {
    const modelo = textoObrigatorio(req.body.modelo, 'Modelo', 80);
    const placa = placaValida(req.body.placa);
    const cor = limparTexto(req.body.cor, 40);

    const atual = await get('SELECT id FROM veiculos WHERE id = ?', [req.params.id]);
    if (!atual) return res.status(404).json({ error: 'Veículo não encontrado' });

    await run('UPDATE veiculos SET modelo = ?, placa = ?, cor = ? WHERE id = ?', [modelo, placa, cor, req.params.id]);
    const row = await get('SELECT * FROM veiculos WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.post('/api/veiculos/migrate-plates', requireAdmin, async (req, res) => {
  try {
    const result = await run("UPDATE veiculos SET placa = REPLACE(placa, '-', '')");
    res.json({ success: true, message: 'Placas normalizadas com sucesso' });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// TIPOS_LAVAGEM API
// ==========================================
app.get('/api/tipos-lavagem', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM tipos_lavagem');
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/tipos-lavagem', requireAdmin, async (req, res) => {
  try {
    const nome = textoObrigatorio(req.body.nome, 'Nome do tipo de lavagem', 80);
    const descricao = limparTexto(req.body.descricao, 300);
    const preco = numeroNaoNegativo(req.body.preco, 'Preço');
    const id = genId();
    await run('INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at) VALUES (?, ?, ?, ?, ?)', [id, nome, descricao, preco, now()]);
    const row = await get('SELECT * FROM tipos_lavagem WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.put('/api/tipos-lavagem/:id', requireAdmin, async (req, res) => {
  try {
    const nome = textoObrigatorio(req.body.nome, 'Nome do tipo de lavagem', 80);
    const descricao = limparTexto(req.body.descricao, 300);
    const preco = numeroNaoNegativo(req.body.preco, 'Preço');

    const atual = await get('SELECT id FROM tipos_lavagem WHERE id = ?', [req.params.id]);
    if (!atual) return res.status(404).json({ error: 'Tipo de lavagem não encontrado' });

    await run('UPDATE tipos_lavagem SET nome = ?, descricao = ?, preco = ? WHERE id = ?', [nome, descricao, preco, req.params.id]);
    const row = await get('SELECT * FROM tipos_lavagem WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.delete('/api/tipos-lavagem/:id', requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM tipos_lavagem WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// LAVAGENS API
// ==========================================
const STATUS_LAVAGEM = ['pendente', 'em_progresso', 'concluida', 'cancelada'];

app.get('/api/lavagens', async (req, res) => {
  try {
    const { cliente_id } = req.query;
    let query = 'SELECT * FROM lavagens';
    let params = [];
    if (cliente_id) { query += ' WHERE cliente_id = ?'; params.push(cliente_id); }
    query += ' ORDER BY data DESC';
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/lavagens', async (req, res) => {
  try {
    const { cliente_id, veiculo_id, tipo_lavagem_id, status, valor, pagamento, observacao } = req.body;
    if (!cliente_id || !veiculo_id || !tipo_lavagem_id) {
      return res.status(400).json({ error: 'Cliente, veículo e tipo de lavagem são obrigatórios.' });
    }
    const statusFinal = status || 'pendente';
    if (!STATUS_LAVAGEM.includes(statusFinal)) {
      return res.status(400).json({ error: `Status inválido. Use um dos: ${STATUS_LAVAGEM.join(', ')}` });
    }
    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      return res.status(400).json({ error: 'O valor da lavagem deve ser um número maior ou igual a zero.' });
    }
    const observacaoLimpa = limparTexto(observacao, 500);
    const pagamentoLimpo = limparTexto(pagamento, 40) || 'Pendente';

    const id = genId();
    const dataConclusao = statusFinal === 'concluida' ? now() : null;
    await run(`INSERT INTO lavagens (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao, data_conclusao)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cliente_id, veiculo_id, tipo_lavagem_id, statusFinal, valorNum, now(), req.user.id, pagamentoLimpo, observacaoLimpa, dataConclusao]);
    const row = await get('SELECT * FROM lavagens WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.put('/api/lavagens/:id', async (req, res) => {
  try {
    const { status, valor, pagamento, observacao, data_conclusao } = req.body;
    if (status !== undefined && !STATUS_LAVAGEM.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Use um dos: ${STATUS_LAVAGEM.join(', ')}` });
    }
    let valorNum;
    if (valor !== undefined) {
      valorNum = Number(valor);
      if (!Number.isFinite(valorNum) || valorNum < 0) {
        return res.status(400).json({ error: 'O valor da lavagem deve ser um número maior ou igual a zero.' });
      }
    }

    const anterior = await get('SELECT valor, pagamento, status FROM lavagens WHERE id = ?', [req.params.id]);
    if (!anterior) return res.status(404).json({ error: 'Lavagem não encontrada' });

    const pagamentoLimpo = pagamento !== undefined ? limparTexto(pagamento, 40) : undefined;
    const observacaoLimpa = observacao !== undefined ? limparTexto(observacao, 500) : undefined;

    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (valor !== undefined) { updates.push('valor = ?'); params.push(valorNum); }
    if (pagamento !== undefined) { updates.push('pagamento = ?'); params.push(pagamentoLimpo); }
    if (observacao !== undefined) { updates.push('observacao = ?'); params.push(observacaoLimpa); }

    // data_conclusao é preenchida automaticamente ao concluir a lavagem, nunca recebida do cliente
    if (status === 'concluida') {
      updates.push('data_conclusao = ?'); params.push(now());
    } else if (data_conclusao !== undefined) {
      updates.push('data_conclusao = ?'); params.push(data_conclusao);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      await run(`UPDATE lavagens SET ${updates.join(', ')} WHERE id = ?`, params);

      // Trilha de auditoria: registra quem alterou campos financeiros e qual era
      // o valor anterior. Sem isso, reduzir o valor de uma lavagem antiga é
      // indistinguível de um lançamento legítimo no dashboard de BI.
      const novosValores = { status, valor: valorNum, pagamento: pagamentoLimpo };
      for (const campo of ['valor', 'pagamento', 'status']) {
        const novo = novosValores[campo];
        if (novo === undefined) continue;
        if (String(novo) === String(anterior[campo])) continue;

        await run(`INSERT INTO auditoria_lavagens (id, lavagem_id, user_id, campo, valor_anterior, valor_novo, data)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [genId(), req.params.id, req.user.id, campo,
           anterior[campo] === null ? null : String(anterior[campo]),
           novo === null ? null : String(novo), now()]);
      }
    }
    const row = await get('SELECT * FROM lavagens WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.delete('/api/lavagens/:id', async (req, res) => {
  try {
    await run('DELETE FROM lavagens WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// PRODUTOS API
// ==========================================
app.get('/api/produtos', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM produtos', []);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/produtos', requireAdmin, async (req, res) => {
  try {
    const nome = textoObrigatorio(req.body.nome, 'Nome do produto', 120);
    const quantidade = numeroNaoNegativo(req.body.quantidade, 'Quantidade', 0);
    const estoqueMinimo = numeroNaoNegativo(req.body.estoque_minimo, 'Estoque mínimo', 5);
    const precoUnitario = numeroNaoNegativo(req.body.preco_unitario, 'Preço unitário', 0);
    const categoria = limparTexto(req.body.categoria, 60) || 'Outros';
    const unidade = limparTexto(req.body.unidade, 10) || 'un';

    const id = genId();
    await run(`INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nome, quantidade, estoqueMinimo, categoria, unidade, precoUnitario, req.user.id, now()]);
    const row = await get('SELECT * FROM produtos WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.put('/api/produtos/:id', requireAdmin, async (req, res) => {
  try {
    const atual = await get('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
    if (!atual) return res.status(404).json({ error: 'Produto não encontrado' });

    const nome = textoObrigatorio(req.body.nome, 'Nome do produto', 120);
    const quantidade = numeroNaoNegativo(req.body.quantidade, 'Quantidade', atual.quantidade);
    const estoqueMinimo = numeroNaoNegativo(req.body.estoque_minimo, 'Estoque mínimo', atual.estoque_minimo);
    const precoUnitario = numeroNaoNegativo(req.body.preco_unitario, 'Preço unitário', atual.preco_unitario);
    const categoria = limparTexto(req.body.categoria, 60) || atual.categoria;
    const unidade = limparTexto(req.body.unidade, 10) || atual.unidade;

    await run(`UPDATE produtos SET nome = ?, quantidade = ?, estoque_minimo = ?, categoria = ?, unidade = ?, preco_unitario = ? WHERE id = ?`,
      [nome, quantidade, estoqueMinimo, categoria, unidade, precoUnitario, req.params.id]);
    const row = await get('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { responderErro(res, err); }
});

app.delete('/api/produtos/:id', requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// MOVIMENTACOES API
// ==========================================
app.get('/api/movimentacoes', async (req, res) => {
  try {
    let query = 'SELECT * FROM movimentacoes';
    let params = [];
    query += ' ORDER BY data DESC';
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

const TIPOS_MOVIMENTACAO = ['entrada', 'saida'];

// Todas as requisições compartilham uma única conexão SQLite, e o sqlite3 não
// aceita BEGIN aninhado nela: duas movimentações simultâneas faziam a segunda
// falhar com "cannot start a transaction within a transaction" (HTTP 500).
// Esta fila serializa as seções críticas — as requisições concorrentes esperam
// sua vez em vez de falhar, e o BEGIN IMMEDIATE continua garantindo que leitura
// e escrita do saldo sejam atômicas.
let filaTransacoes = Promise.resolve();

function emTransacaoSerializada(tarefa) {
  const resultado = filaTransacoes.then(tarefa, tarefa);
  // A fila nunca "quebra": um erro da tarefa é devolvido ao chamador, mas a
  // corrente segue viva para a próxima requisição.
  filaTransacoes = resultado.then(() => undefined, () => undefined);
  return resultado;
}

app.post('/api/movimentacoes', requireAdmin, async (req, res) => {
  const { produto_id, tipo, observacao } = req.body;
  const quantidade = Number(req.body.quantidade);

  if (!TIPOS_MOVIMENTACAO.includes(tipo)) {
    return res.status(400).json({ error: `Campo 'tipo' inválido. Use um dos: ${TIPOS_MOVIMENTACAO.join(', ')}` });
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return res.status(400).json({ error: 'A quantidade deve ser um número positivo.' });
  }

  try {
    // A seção crítica roda serializada (ver emTransacaoSerializada) e devolve o
    // que a rota deve responder, em vez de escrever na resposta lá dentro.
    const resultado = await emTransacaoSerializada(async () => {
      // BEGIN IMMEDIATE trava a escrita já no início da transação, evitando que duas
      // movimentações concorrentes leiam o mesmo estoque antigo e gerem um "lost update".
      await exec('BEGIN IMMEDIATE TRANSACTION;');
      try {
        const produto = await get('SELECT quantidade FROM produtos WHERE id = ?', [produto_id]);
        if (!produto) {
          await exec('ROLLBACK;');
          return { status: 404, body: { error: 'Produto não encontrado' } };
        }

        if (tipo === 'saida' && produto.quantidade < quantidade) {
          await exec('ROLLBACK;');
          return { status: 400, body: { error: `Estoque insuficiente. Disponível: ${produto.quantidade}` } };
        }

        const novaQuantidade = tipo === 'entrada'
          ? produto.quantidade + quantidade
          : produto.quantidade - quantidade;

        await run('UPDATE produtos SET quantidade = ? WHERE id = ?', [novaQuantidade, produto_id]);

        const id = genId();
        await run(`INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, produto_id, tipo, quantidade, limparTexto(observacao, 500), req.user.id, now()]);

        await exec('COMMIT;');

        const produtoAtualizado = await get('SELECT * FROM produtos WHERE id = ?', [produto_id]);
        const row = await get('SELECT * FROM movimentacoes WHERE id = ?', [id]);
        return { status: 200, body: { movimentacao: row, produto: produtoAtualizado } };
      } catch (e) {
        // ROLLBACK best-effort: se ele próprio falhar, o erro original é o que importa.
        await exec('ROLLBACK;').catch(() => {});
        throw e;
      }
    });

    res.status(resultado.status).json(resultado.body);
  } catch (err) { responderErro(res, err); }
});

// ==========================================
// DASHBOARD & ANALYTICS API
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 1. Resumo Financeiro da Semana Atual vs Semana Anterior
    const semanaAtual = await get(`
      SELECT 
        COUNT(*) as lavagens, 
        COALESCE(SUM(valor), 0) as receita
      FROM lavagens
      WHERE status = 'concluida' AND data >= datetime('now', '-7 days')
    `);

    const semanaAnterior = await get(`
      SELECT 
        COUNT(*) as lavagens, 
        COALESCE(SUM(valor), 0) as receita
      FROM lavagens
      WHERE status = 'concluida' 
        AND data >= datetime('now', '-14 days') 
        AND data < datetime('now', '-7 days')
    `);

    const receitaSemana = Number(semanaAtual?.receita || 0);
    const lavagensSemana = Number(semanaAtual?.lavagens || 0);
    const ticketMedio = lavagensSemana > 0 ? Number((receitaSemana / lavagensSemana).toFixed(2)) : 0;

    const receitaSemanaAnterior = Number(semanaAnterior?.receita || 0);
    const lavagensSemanaAnterior = Number(semanaAnterior?.lavagens || 0);
    const ticketMedioAnterior = lavagensSemanaAnterior > 0 ? (receitaSemanaAnterior / lavagensSemanaAnterior) : 0;

    let variacaoReceitaPct = 0;
    if (receitaSemanaAnterior > 0) {
      variacaoReceitaPct = Number((((receitaSemana - receitaSemanaAnterior) / receitaSemanaAnterior) * 100).toFixed(1));
    } else if (receitaSemana > 0) {
      variacaoReceitaPct = 100;
    }

    let variacaoTicketPct = 0;
    if (ticketMedioAnterior > 0) {
      variacaoTicketPct = Number((((ticketMedio - ticketMedioAnterior) / ticketMedioAnterior) * 100).toFixed(1));
    } else if (ticketMedio > 0) {
      variacaoTicketPct = 100;
    }

    // Fluxo Diário dos Últimos 7 dias (Série temporal contínua para o gráfico)
    const ultimos7DiasRows = await all(`
      SELECT 
        substr(data, 1, 10) as dia_data,
        COUNT(*) as lavagens,
        COALESCE(SUM(valor), 0) as receita
      FROM lavagens
      WHERE status = 'concluida' AND data >= date('now', '-6 days')
      GROUP BY substr(data, 1, 10)
    `);

    const mapaDias = new Map();
    ultimos7DiasRows.forEach(r => {
      mapaDias.set(r.dia_data, { lavagens: Number(r.lavagens), receita: Number(r.receita) });
    });

    const diasSemanaNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const fluxoDiario7d = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dataIso = d.toISOString().slice(0, 10);
      const diaNome = diasSemanaNomes[d.getDay()];
      const registro = mapaDias.get(dataIso) || { lavagens: 0, receita: 0 };
      fluxoDiario7d.push({
        data: dataIso,
        dia: diaNome,
        lavagens: registro.lavagens,
        receita: registro.receita
      });
    }

    // 2. Taxa de Recorrência e Fidelização
    const recorrenciaRows = await all(`
      SELECT cliente_id, COUNT(*) as qtd
      FROM lavagens
      WHERE status = 'concluida'
      GROUP BY cliente_id
    `);
    const totalClientesComLavagem = recorrenciaRows.length;
    const clientesRecorrentes = recorrenciaRows.filter(r => r.qtd >= 2).length;
    const taxaRecorrenciaPct = totalClientesComLavagem > 0 
      ? Number(((clientesRecorrentes / totalClientesComLavagem) * 100).toFixed(1)) 
      : 0;

    // 3. Radar de Clientes Ausentes (> 30 dias)
    const clientesAusentes = await all(`
      SELECT 
        c.id, 
        c.nome, 
        c.telefone,
        MAX(l.data) as ultima_visita,
        CAST(julianday('now') - julianday(MAX(l.data)) AS INTEGER) as dias_ausente,
        COUNT(l.id) as historico_lavagens
      FROM clientes c
      JOIN lavagens l ON l.cliente_id = c.id
      WHERE l.status = 'concluida'
      GROUP BY c.id, c.nome, c.telefone
      HAVING dias_ausente >= 30
      ORDER BY historico_lavagens DESC, dias_ausente ASC
      LIMIT 5
    `);

    // 4. Mix de Serviços dos Últimos 30 Dias (Volume vs Receita)
    const mixTipos = await all(`
      SELECT 
        t.id, 
        t.nome,
        COUNT(l.id) as total_atendimentos,
        COALESCE(SUM(l.valor), 0) as faturamento_total
      FROM tipos_lavagem t
      LEFT JOIN lavagens l ON l.tipo_lavagem_id = t.id AND l.status = 'concluida' AND l.data >= datetime('now', '-30 days')
      GROUP BY t.id, t.nome
      ORDER BY faturamento_total DESC
    `);

    const totalAtendimentos30d = mixTipos.reduce((s, t) => s + Number(t.total_atendimentos), 0);
    const totalFaturamento30d = mixTipos.reduce((s, t) => s + Number(t.faturamento_total), 0);

    const mixServicos = mixTipos.map(item => {
      const atendimentos = Number(item.total_atendimentos);
      const faturamento = Number(item.faturamento_total);
      return {
        id: item.id,
        nome: item.nome,
        total_atendimentos: atendimentos,
        faturamento_total: faturamento,
        pct_volume: totalAtendimentos30d > 0 ? Number(((atendimentos / totalAtendimentos30d) * 100).toFixed(1)) : 0,
        pct_receita: totalFaturamento30d > 0 ? Number(((faturamento / totalFaturamento30d) * 100).toFixed(1)) : 0,
      };
    });

    // 5. Insumos em Estado Crítico com Cálculo do Runway
    const produtosCriticos = await all(`
      WITH consumo_recente AS (
        SELECT 
          produto_id,
          COALESCE(SUM(quantidade), 0) as total_saida,
          COUNT(DISTINCT substr(data, 1, 10)) as dias_registrados
        FROM movimentacoes
        WHERE tipo = 'saida' AND data >= datetime('now', '-30 days')
        GROUP BY produto_id
      )
      SELECT 
        p.id,
        p.nome,
        p.quantidade,
        p.estoque_minimo,
        p.unidade,
        p.preco_unitario,
        COALESCE(c.total_saida, 0) as total_saida_30d
      FROM produtos p
      LEFT JOIN consumo_recente c ON c.produto_id = p.id
      WHERE p.quantidade <= p.estoque_minimo
      ORDER BY p.quantidade ASC
    `);

    const estoqueCritico = produtosCriticos.map(p => {
      const qtd = Number(p.quantidade);
      const estoqueMin = Number(p.estoque_minimo);
      const saida30d = Number(p.total_saida_30d);
      const consumoDiario = Number((saida30d / 30.0).toFixed(2));
      
      let diasRestantes = null;
      let statusPrevisao = 'alerta';

      if (qtd <= 0) {
        diasRestantes = 0;
        statusPrevisao = 'zerado';
      } else if (consumoDiario > 0) {
        diasRestantes = Math.floor(qtd / consumoDiario);
        if (diasRestantes <= 3) statusPrevisao = 'urgente';
        else if (diasRestantes <= 7) statusPrevisao = 'atencao';
        else statusPrevisao = 'moderado';
      } else {
        statusPrevisao = 'repor';
      }

      return {
        id: p.id,
        nome: p.nome,
        quantidade: qtd,
        estoque_minimo: estoqueMin,
        unidade: p.unidade,
        consumo_diario: consumoDiario,
        dias_restantes: diasRestantes,
        status_previsao: statusPrevisao
      };
    });

    res.json({
      financeiro: {
        receita_semana: receitaSemana,
        lavagens_semana: lavagensSemana,
        ticket_medio: ticketMedio,
        receita_semana_anterior: receitaSemanaAnterior,
        lavagens_semana_anterior: lavagensSemanaAnterior,
        variacao_receita_pct: variacaoReceitaPct,
        variacao_ticket_pct: variacaoTicketPct,
        fluxo_diario_7d: fluxoDiario7d
      },
      fidelizacao: {
        total_clientes_com_lavagem: totalClientesComLavagem,
        clientes_recorrentes: clientesRecorrentes,
        taxa_recorrencia_pct: taxaRecorrenciaPct
      },
      clientes_ausentes: clientesAusentes,
      mix_servicos: mixServicos,
      estoque_critico: estoqueCritico
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

// ==========================================
// BACKUP & RESET API
// ==========================================
// Allowlist de colunas por tabela, usada para validar o cabeçalho do CSV
// antes de montar a query de import (evita SQL Injection via nome de coluna).
const TABLE_COLUMNS = {
  users: ['id', 'email', 'nome', 'password_hash', 'role', 'created_at'],
  clientes: ['id', 'user_id', 'nome', 'telefone', 'created_at'],
  veiculos: ['id', 'cliente_id', 'user_id', 'modelo', 'placa', 'cor', 'marca', 'created_at'],
  tipos_lavagem: ['id', 'nome', 'descricao', 'preco', 'created_at'],
  lavagens: ['id', 'cliente_id', 'veiculo_id', 'tipo_lavagem_id', 'status', 'valor', 'data', 'user_id', 'pagamento', 'observacao', 'data_conclusao'],
  produtos: ['id', 'nome', 'quantidade', 'estoque_minimo', 'categoria', 'unidade', 'preco_unitario', 'user_id', 'created_at'],
  movimentacoes: ['id', 'produto_id', 'tipo', 'quantidade', 'observacao', 'user_id', 'data'],
  auditoria_lavagens: ['id', 'lavagem_id', 'user_id', 'campo', 'valor_anterior', 'valor_novo', 'data'],
};

// Colunas que podem SAIR do servidor. password_hash é deliberadamente omitido:
// um backup circula por Downloads, e-mail e pendrive, e hashes bcrypt em mãos
// de um atacante permitem cracking offline ilimitado.
const EXPORT_COLUMNS = {
  ...TABLE_COLUMNS,
  users: ['id', 'email', 'nome', 'role', 'created_at'],
};

// Colunas que podem ENTRAR via CSV. password_hash também é omitido: aceitar um
// hash arbitrário do arquivo permitiria injetar credenciais conhecidas pelo
// atacante. Usuários restaurados recebem senha temporária aleatória.
const IMPORT_COLUMNS = {
  ...TABLE_COLUMNS,
  users: ['id', 'email', 'nome', 'role', 'created_at'],
};

app.get('/api/backup/export', requireAdmin, async (req, res) => {
  try {
    const backup = {};
    for (const table of tables) {
      const colunas = EXPORT_COLUMNS[table].join(', ');
      const rows = await all(`SELECT ${colunas} FROM ${table}`);
      backup[table] = stringify(rows, {
        header: true,
        cast: { string: sanitizeCsvCell },
      });
    }
    res.json(backup);
  } catch (err) {
    handleServerError(res, err);
  }
});

app.post('/api/backup/import', requireAdmin, upload.any(), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Identificar tabelas pelos nomes dos arquivos (o fileFilter do multer já
    // rejeitou qualquer nome fora da allowlist antes de chegar aqui).
    const dataToImport = {};
    for (const file of files) {
      // name e.g. "clientes.csv"
      const tableName = path.basename(file.originalname, path.extname(file.originalname));
      if (tables.includes(tableName)) {
        const records = parse(file.buffer, { columns: true, skip_empty_lines: true });
        dataToImport[tableName] = records;
      }
    }

    let importedCount = 0;
    const senhasTemporarias = [];

    // Serializado junto das movimentações e do reset: todos abrem transação na
    // mesma conexão SQLite e não podem se sobrepor.
    await emTransacaoSerializada(async () => {
    await exec('PRAGMA foreign_keys = OFF;');
    await exec('BEGIN TRANSACTION;');

    try {
      // Ordem de dependência. auditoria_lavagens vem logo após lavagens:
      // suas linhas referenciam lavagens(id), e a ordem decide se o
      // foreign_key_check do fim do fluxo passa ou derruba o import inteiro.
      const order = ['users', 'clientes', 'veiculos', 'tipos_lavagem', 'produtos', 'lavagens', 'auditoria_lavagens', 'movimentacoes'];
      
      // Limpar tabelas que estão sendo importadas
      for (const table of order) {
        if (dataToImport[table]) {
          await exec(`DELETE FROM ${table};`);
        }
      }

      for (const table of order) {
        const records = dataToImport[table];
        if (!records || records.length === 0) continue;

        const columns = Object.keys(records[0]);
        const colunasInvalidas = columns.filter(c => !IMPORT_COLUMNS[table].includes(c));
        if (colunasInvalidas.length > 0) {
          throw new ValidacaoError(
            `Colunas inválidas em ${table}.csv: ${colunasInvalidas.join(', ')}. ` +
            `Permitidas: ${IMPORT_COLUMNS[table].join(', ')}`
          );
        }

        // Usuários restaurados nunca trazem hash do arquivo: cada um recebe uma
        // senha temporária aleatória, devolvida ao admin na resposta para que
        // ele a entregue ao usuário.
        const colunasInsert = table === 'users' ? [...columns, 'password_hash'] : columns;
        const placeholders = colunasInsert.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${colunasInsert.join(', ')}) VALUES (${placeholders})`;

        for (const record of records) {
          const values = columns.map(col => record[col] === '' ? null : record[col]);

          if (table === 'users') {
            const senhaTemporaria = crypto.randomBytes(9).toString('base64url');
            senhasTemporarias.push({ email: record.email, senha_temporaria: senhaTemporaria });
            values.push(await bcrypt.hash(senhaTemporaria, 10));
          }

          await run(sql, values);
          importedCount++;
        }
      }

      // Com as FKs desligadas o SQLite aceitaria referências órfãs (ex: uma
      // lavagem apontando para um cliente que não veio no backup). Esta
      // verificação acontece com a transação ainda aberta, então um backup
      // inconsistente é rejeitado por inteiro em vez de corromper o banco.
      const problemasFk = await all('PRAGMA foreign_key_check;');
      if (problemasFk.length > 0) {
        const tabelasAfetadas = [...new Set(problemasFk.map(p => p.table))].join(', ');
        throw new ValidacaoError(
          `Backup inconsistente: ${problemasFk.length} referência(s) órfã(s) em ${tabelasAfetadas}. ` +
          'Nenhum dado foi importado.'
        );
      }

      await exec('COMMIT;');
    } catch (e) {
      await exec('ROLLBACK;').catch(() => {});
      throw e;
    } finally {
      // Reativa as FKs sempre fora da transação, senão o PRAGMA é no-op.
      await exec('PRAGMA foreign_keys = ON;').catch(() => {});
    }
    });

    res.json({
      success: true,
      records: importedCount,
      warnings: [],
      senhas_temporarias: senhasTemporarias,
    });
  } catch (err) {
    responderErro(res, err);
  }
});

app.post('/api/backup/reset', requireAdmin, async (req, res) => {
  try {
    // Serializado junto das movimentações: as duas abrem transação na mesma
    // conexão SQLite e não podem se sobrepor.
    await emTransacaoSerializada(async () => {
      await exec('PRAGMA foreign_keys = OFF;');
      try {
        await exec('BEGIN TRANSACTION;');
        try {
          // Com as FKs desligadas o ON DELETE CASCADE de auditoria_lavagens
          // não dispara, então ela precisa ser apagada explicitamente junto
          // com as demais — senão o reset deixaria linhas de auditoria de
          // lavagens que já não existem.
          for (const table of tables) {
            await exec(`DELETE FROM ${table};`);
          }
          await exec('COMMIT;');
        } catch (e) {
          await exec('ROLLBACK;').catch(() => {});
          throw e;
        }
      } finally {
        // Reativa as FKs sempre fora da transação, senão o PRAGMA é no-op.
        await exec('PRAGMA foreign_keys = ON;').catch(() => {});
      }
    });
    res.json({ success: true });
  } catch (err) {
    responderErro(res, err);
  }
});

// ==========================================
// ERROR HANDLER GLOBAL
// Registrado depois de todas as rotas. Converte erros de upload, CORS e
// validação em respostas limpas, e qualquer outra exceção em 500 genérico —
// nunca um stack trace do Express para o cliente.
// ==========================================
app.use((err, req, res, next) => {
  if (!err) return next();
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    console.error('Upload rejeitado:', err.code, err.message);
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const mensagem = err.code === 'LIMIT_FILE_SIZE'
      ? 'Arquivo de backup muito grande. O limite é 5 MB por CSV.'
      : 'Upload inválido. Envie apenas os arquivos CSV gerados pelo export.';
    return res.status(status).json({ error: mensagem });
  }

  // Corpo JSON acima do limite de 200kb (lançado pelo body-parser).
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo da requisição muito grande.' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }

  if (err.status && err.clientMessage) {
    if (err instanceof CorsError) console.warn(err.message);
    return res.status(err.status).json({ error: err.clientMessage });
  }

  return handleServerError(res, err);
});

const PORT = process.env.PORT || 3001;

// Inicia o servidor se não estiver sendo executado como Serverless Function (ex: Vercel)
//
// O listen espera o dbReady: as rotas fazem INSERT em tabelas que só existem
// depois que o schema roda (ex: auditoria_lavagens). Sem esta espera, subir a
// porta em paralelo com a aplicação do schema abria uma janela em que o
// primeiro PUT de lavagem respondia 500 com "no such table".
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  dbReady.then(() => {
    app.listen(PORT, () => {
      console.log(`Backend SQLite rodando na porta ${PORT}`);
    });
  }).catch((err) => {
    console.error('Servidor não iniciado: banco de dados indisponível.', err);
    process.exit(1);
  });
}

// Compatibilidade CommonJS e ES Modules para Vercel Serverless Function
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
}

export { app };
export default app;
