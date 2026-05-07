import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import crypto from 'crypto';
import db, { get, all, run, exec } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const genId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ==========================================
// USERS API
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const users = await all('SELECT * FROM users');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { id, email, nome, role } = req.body;
    const newId = id || genId();
    await run('INSERT INTO users (id, email, nome, role, created_at) VALUES (?, ?, ?, ?, ?)', [newId, email, nome, role || 'operador', now()]);
    const user = await get('SELECT * FROM users WHERE id = ?', [newId]);
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// CLIENTES API
// ==========================================
app.get('/api/clientes', async (req, res) => {
  try {
    // Retorna todos os clientes (sem filtro por user_id para simplificar)
    const rows = await all('SELECT * FROM clientes', []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const { user_id, nome, telefone } = req.body;
    const id = genId();
    const created_at = now();
    await run('INSERT INTO clientes (id, user_id, nome, telefone, created_at) VALUES (?, ?, ?, ?, ?)', [id, user_id, nome, telefone, created_at]);
    const row = await get('SELECT * FROM clientes WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { nome, telefone } = req.body;
    await run('UPDATE clientes SET nome = ?, telefone = ? WHERE id = ?', [nome, telefone, req.params.id]);
    const row = await get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/veiculos', async (req, res) => {
  try {
    const { cliente_id, user_id, placa, marca, cor, modelo } = req.body;
    const id = genId();
    await run('INSERT INTO veiculos (id, cliente_id, user_id, placa, marca, cor, modelo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [id, cliente_id, user_id, placa, marca, cor, modelo, now()]);
    const row = await get('SELECT * FROM veiculos WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/veiculos/:id', async (req, res) => {
  try {
    await run('DELETE FROM veiculos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/veiculos/:id', async (req, res) => {
  try {
    const { modelo, placa, cor } = req.body;
    await run('UPDATE veiculos SET modelo = ?, placa = ?, cor = ? WHERE id = ?', [modelo, placa, cor, req.params.id]);
    const row = await get('SELECT * FROM veiculos WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// TIPOS_LAVAGEM API
// ==========================================
app.get('/api/tipos-lavagem', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM tipos_lavagem');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tipos-lavagem', async (req, res) => {
  try {
    const { nome, descricao, preco } = req.body;
    const id = genId();
    await run('INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at) VALUES (?, ?, ?, ?, ?)', [id, nome, descricao, preco, now()]);
    const row = await get('SELECT * FROM tipos_lavagem WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tipos-lavagem/:id', async (req, res) => {
  try {
    const { nome, descricao, preco } = req.body;
    await run('UPDATE tipos_lavagem SET nome = ?, descricao = ?, preco = ? WHERE id = ?', [nome, descricao, preco, req.params.id]);
    const row = await get('SELECT * FROM tipos_lavagem WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tipos-lavagem/:id', async (req, res) => {
  try {
    await run('DELETE FROM tipos_lavagem WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// LAVAGENS API
// ==========================================
app.get('/api/lavagens', async (req, res) => {
  try {
    const { cliente_id } = req.query;
    let query = 'SELECT * FROM lavagens';
    let params = [];
    if (cliente_id) { query += ' WHERE cliente_id = ?'; params.push(cliente_id); }
    query += ' ORDER BY data DESC';
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lavagens', async (req, res) => {
  try {
    const { cliente_id, veiculo_id, tipo_lavagem_id, status, valor, user_id, pagamento, observacao } = req.body;
    const id = genId();
    await run(`INSERT INTO lavagens (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [id, cliente_id, veiculo_id, tipo_lavagem_id, status || 'pendente', valor, now(), user_id, pagamento || 'Pendente', observacao]);
    const row = await get('SELECT * FROM lavagens WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/lavagens/:id', async (req, res) => {
  try {
    const { status, valor, pagamento, observacao, data_conclusao } = req.body;
    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (valor !== undefined) { updates.push('valor = ?'); params.push(valor); }
    if (pagamento !== undefined) { updates.push('pagamento = ?'); params.push(pagamento); }
    if (observacao !== undefined) { updates.push('observacao = ?'); params.push(observacao); }
    if (data_conclusao !== undefined) { updates.push('data_conclusao = ?'); params.push(data_conclusao); }
    
    if (updates.length > 0) {
      params.push(req.params.id);
      await run(`UPDATE lavagens SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const row = await get('SELECT * FROM lavagens WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/lavagens/:id', async (req, res) => {
  try {
    await run('DELETE FROM lavagens WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// PRODUTOS API
// ==========================================
app.get('/api/produtos', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM produtos', []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/produtos', async (req, res) => {
  try {
    const { nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id } = req.body;
    const id = genId();
    await run(`INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [id, nome, quantidade || 0, estoque_minimo || 5, categoria || 'Outros', unidade || 'un', preco_unitario || 0, user_id, now()]);
    const row = await get('SELECT * FROM produtos WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/produtos/:id', async (req, res) => {
  try {
    const { nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario } = req.body;
    await run(`UPDATE produtos SET nome = ?, quantidade = ?, estoque_minimo = ?, categoria = ?, unidade = ?, preco_unitario = ? WHERE id = ?`, 
      [nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, req.params.id]);
    const row = await get('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/produtos/:id', async (req, res) => {
  try {
    await run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/movimentacoes', async (req, res) => {
  try {
    const { produto_id, tipo, quantidade, observacao, user_id } = req.body;
    const id = genId();
    await run(`INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [id, produto_id, tipo, quantidade, observacao, user_id, now()]);
    const row = await get('SELECT * FROM movimentacoes WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BACKUP & RESET API
// ==========================================
const tables = ['users', 'clientes', 'veiculos', 'tipos_lavagem', 'lavagens', 'produtos', 'movimentacoes'];

app.get('/api/backup/export', async (req, res) => {
  try {
    const backup = {};
    for (const table of tables) {
      const rows = await all(`SELECT * FROM ${table}`);
      backup[table] = stringify(rows, { header: true });
    }
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/import', upload.any(), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Identificar tabelas pelos nomes dos arquivos
    const dataToImport = {};
    for (const file of files) {
      // name e.g. "clientes.csv"
      const tableName = file.originalname.split('.')[0];
      if (tables.includes(tableName)) {
        const records = parse(file.buffer, { columns: true, skip_empty_lines: true });
        dataToImport[tableName] = records;
      }
    }

    let importedCount = 0;

    await exec('PRAGMA foreign_keys = OFF;');
    await exec('BEGIN TRANSACTION;');

    try {
      // Odem de dependência
      const order = ['users', 'clientes', 'veiculos', 'tipos_lavagem', 'produtos', 'lavagens', 'movimentacoes'];
      
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
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

        for (const record of records) {
          const values = columns.map(col => record[col] === '' ? null : record[col]);
          await run(sql, values);
          importedCount++;
        }
      }

      await exec('COMMIT;');
    } catch (e) {
      await exec('ROLLBACK;');
      throw e;
    } finally {
      await exec('PRAGMA foreign_keys = ON;');
    }

    res.json({ success: true, records: importedCount, warnings: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/reset', async (req, res) => {
  try {
    await exec('PRAGMA foreign_keys = OFF;');
    await exec('BEGIN TRANSACTION;');
    try {
      for (const table of tables) {
        await exec(`DELETE FROM ${table};`);
      }
      await exec('COMMIT;');
    } catch(e) {
      await exec('ROLLBACK;');
      throw e;
    } finally {
      await exec('PRAGMA foreign_keys = ON;');
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend SQLite rodando na porta ${PORT}`);
});
