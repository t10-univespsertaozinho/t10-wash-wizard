import crypto from 'crypto';
import db, { run, exec } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stringify } from 'csv-stringify/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function seed() {
  console.log('Iniciando o seeder...');

  try {
    await exec('PRAGMA foreign_keys = OFF;');
    await exec('BEGIN TRANSACTION;');

    // Limpar tabelas
    const tables = ['users', 'clientes', 'veiculos', 'tipos_lavagem', 'produtos', 'lavagens', 'movimentacoes'];
    for (const table of tables) {
      await exec(`DELETE FROM ${table};`);
    }

    // 1. Users
    const adminId = 'admin-local';
    const userId = 'user-local';
    const usersData = [
      [adminId, 'admin@washwizard.com', 'Administrador', 'admin', now()],
      [userId, 'user@washwizard.com', 'Operador Padrão', 'operador', now()]
    ];
    for (const row of usersData) {
      await run(`INSERT INTO users (id, email, nome, role, created_at) VALUES (?, ?, ?, ?, ?)`, row);
    }

    // 2. Clientes
    const clientes = [
      { id: genId(), user_id: adminId, nome: 'João Silva', telefone: '(11) 98765-4321', created_at: now() },
      { id: genId(), user_id: adminId, nome: 'Maria Oliveira', telefone: '(11) 91234-5678', created_at: now() },
      { id: genId(), user_id: adminId, nome: 'Carlos Santos', telefone: '(11) 94567-8901', created_at: now() },
      { id: genId(), user_id: adminId, nome: 'Ana Paula', telefone: '(11) 97654-3210', created_at: now() }
    ];
    for (const c of clientes) {
      await run(`INSERT INTO clientes (id, user_id, nome, telefone, created_at) VALUES (?, ?, ?, ?, ?)`, Object.values(c));
    }

    // 3. Veículos
    const veiculos = [
      { id: genId(), cliente_id: clientes[0].id, user_id: adminId, placa: 'ABC1D23', marca: 'Toyota', cor: 'Prata', modelo: 'Corolla', created_at: now() },
      { id: genId(), cliente_id: clientes[1].id, user_id: adminId, placa: 'XYZ9W87', marca: 'Honda', cor: 'Preto', modelo: 'Civic', created_at: now() },
      { id: genId(), cliente_id: clientes[2].id, user_id: adminId, placa: 'DEF4G56', marca: 'Volkswagen', cor: 'Branco', modelo: 'Gol', created_at: now() },
      { id: genId(), cliente_id: clientes[3].id, user_id: adminId, placa: 'KLM7N89', marca: 'Ford', cor: 'Vermelho', modelo: 'Ka', created_at: now() },
      { id: genId(), cliente_id: clientes[0].id, user_id: adminId, placa: 'HIJ5K67', marca: 'Chevrolet', cor: 'Cinza', modelo: 'Onix', created_at: now() }
    ];
    for (const v of veiculos) {
      await run(`INSERT INTO veiculos (id, cliente_id, user_id, placa, marca, cor, modelo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, Object.values(v));
    }

    // 4. Tipos Lavagem
    const tiposLavagem = [
      { id: genId(), nome: 'Lavagem Simples', descricao: 'Lavagem externa e aspiração básica', preco: 40.0, created_at: now() },
      { id: genId(), nome: 'Lavagem Completa', descricao: 'Lavagem externa, aspiração, painel e cera líquida', preco: 70.0, created_at: now() },
      { id: genId(), nome: 'Higienização Interna', descricao: 'Limpeza profunda de bancos e teto', preco: 150.0, created_at: now() },
      { id: genId(), nome: 'Polimento', descricao: 'Polimento técnico comercial', preco: 250.0, created_at: now() }
    ];
    for (const t of tiposLavagem) {
      await run(`INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at) VALUES (?, ?, ?, ?, ?)`, Object.values(t));
    }

    // 5. Produtos
    const produtos = [
      { id: genId(), nome: 'Shampoo Automotivo', quantidade: 20, estoque_minimo: 5, categoria: 'Limpeza Externa', unidade: 'L', preco_unitario: 15.5, user_id: adminId, created_at: now() },
      { id: genId(), nome: 'Cera de Polimento', quantidade: 8, estoque_minimo: 3, categoria: 'Acabamento', unidade: 'pote', preco_unitario: 45.0, user_id: adminId, created_at: now() },
      { id: genId(), nome: 'Limpa Vidros', quantidade: 15, estoque_minimo: 4, categoria: 'Limpeza Interna', unidade: 'L', preco_unitario: 12.0, user_id: adminId, created_at: now() },
      { id: genId(), nome: 'Pretinho', quantidade: 10, estoque_minimo: 2, categoria: 'Acabamento', unidade: 'L', preco_unitario: 18.0, user_id: adminId, created_at: now() }
    ];
    for (const p of produtos) {
      await run(`INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, Object.values(p));
    }

    // 6. Lavagens
    const dataPassado = () => {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * 30)); // Até 30 dias atrás
      return d.toISOString();
    };

    const lavagens = [
      { id: genId(), cliente_id: clientes[0].id, veiculo_id: veiculos[0].id, tipo_lavagem_id: tiposLavagem[1].id, status: 'concluida', valor: tiposLavagem[1].preco, data: dataPassado(), user_id: adminId, pagamento: 'Pago', observacao: 'Cliente fidelidade', data_conclusao: now() },
      { id: genId(), cliente_id: clientes[1].id, veiculo_id: veiculos[1].id, tipo_lavagem_id: tiposLavagem[0].id, status: 'concluida', valor: tiposLavagem[0].preco, data: dataPassado(), user_id: userId, pagamento: 'Pago', observacao: '', data_conclusao: now() },
      { id: genId(), cliente_id: clientes[2].id, veiculo_id: veiculos[2].id, tipo_lavagem_id: tiposLavagem[2].id, status: 'em_progresso', valor: tiposLavagem[2].preco, data: now(), user_id: userId, pagamento: 'Pendente', observacao: 'Bancos muito sujos', data_conclusao: null },
      { id: genId(), cliente_id: clientes[3].id, veiculo_id: veiculos[3].id, tipo_lavagem_id: tiposLavagem[0].id, status: 'pendente', valor: tiposLavagem[0].preco, data: now(), user_id: userId, pagamento: 'Pendente', observacao: '', data_conclusao: null }
    ];
    for (const l of lavagens) {
      await run(`INSERT INTO lavagens (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao, data_conclusao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, Object.values(l));
    }

    // 7. Movimentações
    const movimentacoes = [
      { id: genId(), produto_id: produtos[0].id, tipo: 'entrada', quantidade: 25, observacao: 'Compra mensal', user_id: adminId, data: dataPassado() },
      { id: genId(), produto_id: produtos[0].id, tipo: 'saida', quantidade: 5, observacao: 'Uso na semana', user_id: userId, data: dataPassado() },
      { id: genId(), produto_id: produtos[1].id, tipo: 'entrada', quantidade: 10, observacao: 'Compra atacado', user_id: adminId, data: dataPassado() },
      { id: genId(), produto_id: produtos[1].id, tipo: 'saida', quantidade: 2, observacao: 'Polimento X', user_id: adminId, data: dataPassado() }
    ];
    for (const m of movimentacoes) {
      await run(`INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)`, Object.values(m));
    }

    await exec('COMMIT;');
    await exec('PRAGMA foreign_keys = ON;');
    console.log('Seed de banco de dados realizado com sucesso!');

    // Gerar os arquivos CSV na pasta de backups
    console.log('Gerando os arquivos CSV de backup...');
    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    for (const table of tables) {
      const records = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${table}`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      const csvStr = stringify(records, { header: true });
      fs.writeFileSync(path.join(backupDir, `${table}.csv`), csvStr);
    }
    
    console.log(`Arquivos CSV gerados na pasta /backups com sucesso!`);
    
    // Encerrar processo
    setTimeout(() => {
      process.exit(0);
    }, 500);
    
  } catch (error) {
    console.error('Erro ao realizar o seed:', error);
    await exec('ROLLBACK;');
    process.exit(1);
  }
}

seed();
