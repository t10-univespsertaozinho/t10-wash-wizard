import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Usar o banco na raiz do projeto para que o servidor use
const DB_PATH = path.resolve(__dirname, '../wash_wizard.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
db.exec('PRAGMA foreign_keys = ON;');

console.log('Iniciando seed de dados...\n');

const getNow = () => new Date().toISOString();
const now = getNow();

// Limpar dados existentes
console.log('Limpando dados existentes...');
db.exec('DELETE FROM movimentacoes');
db.exec('DELETE FROM lavagens');
db.exec('DELETE FROM veiculos');
db.exec('DELETE FROM clientes');
db.exec('DELETE FROM produtos');
db.exec('DELETE FROM tipos_lavagem');
let adminId = 'admin-local';
console.log('Criando usuário admin (se não existir)...');
db.run('INSERT OR IGNORE INTO users (id, email, nome, role, created_at) VALUES (?, ?, ?, ?, ?)',
  adminId, 'admin@washwizard.com', 'Administrador', 'admin', now
);

// Inserir tipos de lavagem
console.log('Inserindo tipos de lavagens...');
const tiposLavagem = [
  { id: 'tl-001', nome: 'Lavagem Simples', descricao: 'Lavagem externa básica com água e sabão', preco: 25.00 },
  { id: 'tl-002', nome: 'Lavagem Completa', descricao: 'Lavagem interna e externa completa', preco: 45.00 },
  { id: 'tl-003', nome: 'Polimento', descricao: 'Polimento completo da pintura', preco: 80.00 },
  { id: 'tl-004', nome: 'Lavagem a Seco', descricao: 'Lavagem ecológica sem uso de água', preco: 35.00 },
  { id: 'tl-005', nome: 'Cera de Proteção', descricao: 'Aplicação de cera de proteção', preco: 50.00 },
  { id: 'tl-006', nome: 'Higienização Interna', descricao: 'Limpeza profunda de estofados e carpetes', preco: 60.00 },
];

const insertTipo = db.prepare('INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at) VALUES (?, ?, ?, ?, ?)');
tiposLavagem.forEach(t => insertTipo.run(t.id, t.nome, t.descricao, t.preco, now));

// Inserir clientes (25 clientes)
console.log('Inserindo clientes...');
const clientes = [
  { id: 'cli-001', nome: 'João Silva', telefone: '(11) 98888-7777' },
  { id: 'cli-002', nome: 'Maria Oliveira', telefone: '(11) 97777-6666' },
  { id: 'cli-003', nome: 'Carlos Santos', telefone: '(11) 96666-5555' },
  { id: 'cli-004', nome: 'Ana Paula', telefone: '(11) 95555-4444' },
  { id: 'cli-005', nome: 'Pedro Costa', telefone: '(11) 94444-3333' },
  { id: 'cli-006', nome: 'Juliana Ferreira', telefone: '(11) 93333-2222' },
  { id: 'cli-007', nome: 'Roberto Alves', telefone: '(11) 92222-1111' },
  { id: 'cli-008', nome: 'Fernanda Lima', telefone: '(11) 91111-0000' },
  { id: 'cli-009', nome: 'Lucas Martins', telefone: '(11) 99999-8888' },
  { id: 'cli-010', nome: 'Camila Rodrigues', telefone: '(11) 98887-7777' },
  { id: 'cli-011', nome: 'Ricardo Souza', telefone: '(11) 97776-6666' },
  { id: 'cli-012', nome: 'Patrícia Almeida', telefone: '(11) 96665-5555' },
  { id: 'cli-013', nome: 'Marcos Pereira', telefone: '(11) 95554-4444' },
  { id: 'cli-014', nome: 'Renata Castro', telefone: '(11) 94443-3333' },
  { id: 'cli-015', nome: 'Gustavo Lima', telefone: '(11) 93332-2222' },
  { id: 'cli-016', nome: 'Aline Barros', telefone: '(11) 92221-1111' },
  { id: 'cli-017', nome: 'Bruno Gomes', telefone: '(11) 91110-0000' },
  { id: 'cli-018', nome: 'Daniela Martins', telefone: '(11) 99998-8888' },
  { id: 'cli-019', nome: 'Thiago Costa', telefone: '(11) 98886-7777' },
  { id: 'cli-020', nome: 'Vanessa Santos', telefone: '(11) 97775-6666' },
  { id: 'cli-021', nome: 'Felipe Oliveira', telefone: '(11) 96664-5555' },
  { id: 'cli-022', nome: 'Gabriela Dias', telefone: '(11) 95553-4444' },
  { id: 'cli-023', nome: 'Leonardo Rodrigues', telefone: '(11) 94442-3333' },
  { id: 'cli-024', nome: 'Isabella Ferreira', telefone: '(11) 93331-2222' },
  { id: 'cli-025', nome: 'Mateus Almeida', telefone: '(11) 92220-1111' },
];

const insertCliente = db.prepare('INSERT INTO clientes (id, user_id, nome, telefone, created_at) VALUES (?, ?, ?, ?, ?)');
clientes.forEach(c => insertCliente.run(c.id, adminId, c.nome, c.telefone, now));

// Inserir veículos (um para cada cliente + alguns com múltiplos)
console.log('Inserindo veículos...');
const veiculos = [
  { id: 'vei-001', cliente_id: 'cli-001', modelo: 'Toyota Corolla', placa: 'ABC-1234', cor: 'Prata', marca: 'Toyota' },
  { id: 'vei-002', cliente_id: 'cli-002', modelo: 'Honda Civic', placa: 'XYZ-9876', cor: 'Preto', marca: 'Honda' },
  { id: 'vei-003', cliente_id: 'cli-003', modelo: 'Volkswagen Gol', placa: 'DEF-5678', cor: 'Branco', marca: 'Volkswagen' },
  { id: 'vei-004', cliente_id: 'cli-004', modelo: 'Ford Ka', placa: 'GHI-9012', cor: 'Vermelho', marca: 'Ford' },
  { id: 'vei-005', cliente_id: 'cli-005', modelo: 'Chevrolet Onix', placa: 'JKL-3456', cor: 'Cinza', marca: 'Chevrolet' },
  { id: 'vei-006', cliente_id: 'cli-006', modelo: 'Hyundai HB20', placa: 'MNO-7890', cor: 'Azul', marca: 'Hyundai' },
  { id: 'vei-007', cliente_id: 'cli-007', modelo: 'Fiat Uno', placa: 'PQR-1234', cor: 'Verde', marca: 'Fiat' },
  { id: 'vei-008', cliente_id: 'cli-008', modelo: 'Jeep Renegade', placa: 'STU-5678', cor: 'Laranja', marca: 'Jeep' },
  { id: 'vei-009', cliente_id: 'cli-009', modelo: 'Nissan Versa', placa: 'VWX-9012', cor: 'Preto', marca: 'Nissan' },
  { id: 'vei-010', cliente_id: 'cli-010', modelo: 'Toyota Etios', placa: 'YZA-3456', cor: 'Branco', marca: 'Toyota' },
  { id: 'vei-011', cliente_id: 'cli-011', modelo: 'Honda Fit', placa: 'BCD-7890', cor: 'Cinza', marca: 'Honda' },
  { id: 'vei-012', cliente_id: 'cli-012', modelo: 'Volkswagen Passat', placa: 'EFG-1234', cor: 'Prata', marca: 'Volkswagen' },
  { id: 'vei-013', cliente_id: 'cli-013', modelo: 'Ford EcoSport', placa: 'HIJ-5678', cor: 'Vermelho', marca: 'Ford' },
  { id: 'vei-014', cliente_id: 'cli-014', modelo: 'Chevrolet Spin', placa: 'KLM-9012', cor: 'Azul', marca: 'Chevrolet' },
  { id: 'vei-015', cliente_id: 'cli-015', modelo: 'Hyundai Creta', placa: 'NOP-3456', cor: 'Branco', marca: 'Hyundai' },
  { id: 'vei-016', cliente_id: 'cli-016', modelo: 'Fiat Pulse', placa: 'QRS-7890', cor: 'Preto', marca: 'Fiat' },
  { id: 'vei-017', cliente_id: 'cli-017', modelo: 'Jeep Compass', placa: 'TUV-1234', cor: 'Cinza', marca: 'Jeep' },
  { id: 'vei-018', cliente_id: 'cli-018', modelo: 'Nissan Kicks', placa: 'WXY-5678', cor: 'Vermelho', marca: 'Nissan' },
  { id: 'vei-019', cliente_id: 'cli-019', modelo: 'Toyota Yaris', placa: 'ZAB-9012', cor: 'Prata', marca: 'Toyota' },
  { id: 'vei-020', cliente_id: 'cli-020', modelo: 'Honda City', placa: 'CDE-3456', cor: 'Branco', marca: 'Honda' },
  { id: 'vei-021', cliente_id: 'cli-021', modelo: 'Volkswagen Virtus', placa: 'FGH-7890', cor: 'Azul', marca: 'Volkswagen' },
  { id: 'vei-022', cliente_id: 'cli-022', modelo: 'Ford Territory', placa: 'IJK-1234', cor: 'Preto', marca: 'Ford' },
  { id: 'vei-023', cliente_id: 'cli-023', modelo: 'Chevrolet Trailblazer', placa: 'LMN-5678', cor: 'Cinza', marca: 'Chevrolet' },
  { id: 'vei-024', cliente_id: 'cli-024', modelo: 'Hyundai Tucson', placa: 'OPQ-9012', cor: 'Verde', marca: 'Hyundai' },
  { id: 'vei-025', cliente_id: 'cli-025', modelo: 'Fiat Strada', placa: 'RST-3456', cor: 'Branco', marca: 'Fiat' },
  { id: 'vei-026', cliente_id: 'cli-001', modelo: 'Toyota Camry', placa: 'UVW-7890', cor: 'Preto', marca: 'Toyota' },
  { id: 'vei-027', cliente_id: 'cli-003', modelo: 'Honda CR-V', placa: 'XYZ-1234', cor: 'Cinza', marca: 'Honda' },
];

const insertVeiculo = db.prepare('INSERT INTO veiculos (id, cliente_id, user_id, modelo, placa, cor, marca, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
veiculos.forEach(v => insertVeiculo.run(v.id, v.cliente_id, adminId, v.modelo, v.placa, v.cor, v.marca, now));

// Inserir produtos
console.log('Inserindo produtos...');
const produtos = [
  { id: 'prod-001', nome: 'Shampoo Automotivo', quantidade: 25, estoque_minimo: 10, categoria: 'Limpeza', unidade: 'L', preco_unitario: 12.00 },
  { id: 'prod-002', nome: 'Cera de Polimento', quantidade: 8, estoque_minimo: 5, categoria: 'Polimento', unidade: 'un', preco_unitario: 25.00 },
  { id: 'prod-003', nome: 'Limpa Vidros', quantidade: 15, estoque_minimo: 8, categoria: 'Limpeza', unidade: 'L', preco_unitario: 8.00 },
  { id: 'prod-004', nome: 'Desengraxante', quantidade: 12, estoque_minimo: 5, categoria: 'Limpeza', unidade: 'L', preco_unitario: 15.00 },
  { id: 'prod-005', nome: 'Silicone Repelente', quantidade: 20, estoque_minimo: 10, categoria: 'Proteção', unidade: 'un', preco_unitario: 18.00 },
  { id: 'prod-006', nome: 'Escova de Limpeza', quantidade: 30, estoque_minimo: 15, categoria: 'Outros', unidade: 'un', preco_unitario: 5.00 },
  { id: 'prod-007', nome: 'Pano de Microfibra', quantidade: 50, estoque_minimo: 20, categoria: 'Outros', unidade: 'un', preco_unitario: 3.00 },
  { id: 'prod-008', nome: 'Cera Líquida', quantidade: 5, estoque_minimo: 8, categoria: 'Polimento', unidade: 'L', preco_unitario: 22.00 },
  { id: 'prod-009', nome: 'Shampoo Seco', quantidade: 10, estoque_minimo: 5, categoria: 'Limpeza', unidade: 'L', preco_unitario: 20.00 },
  { id: 'prod-010', nome: 'Borrifador', quantidade: 3, estoque_minimo: 10, categoria: 'Outros', unidade: 'un', preco_unitario: 4.00 },
];

const insertProduto = db.prepare('INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
produtos.forEach(p => insertProduto.run(p.id, p.nome, p.quantidade, p.estoque_minimo, p.categoria, p.unidade, p.preco_unitario, adminId, now));

// Inserir lavagens (dados dos últimos 6 meses)
console.log('Inserindo lavagens (dados históricos)...');

const generateRandomDate = (monthsAgo) => {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(Math.floor(Math.random() * 28) + 1);
  date.setHours(Math.floor(Math.random() * 10) + 8);
  date.setMinutes(Math.floor(Math.random() * 60));
  return date.toISOString();
};

const statuses = ['concluida', 'pendente', 'em_progresso', 'cancelada'];
const pagamentos = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Pendente'];

const lavagens = [];
let lavId = 1;

// Gerar lavagens para os últimos 6 meses
for (let m = 0; m < 6; m++) {
  const lavagensNoMes = Math.floor(Math.random() * 15) + 10;
  
  for (let i = 0; i < lavagensNoMes; i++) {
    const veiculo = veiculos[Math.floor(Math.random() * veiculos.length)];
    const tipo = tiposLavagem[Math.floor(Math.random() * tiposLavagem.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const pagamento = status === 'concluida' ? pagamentos[Math.floor(Math.random() * 4)] : 'Pendente';
    const data = generateRandomDate(m);
    
    lavagens.push({
      id: `lav-${String(lavId++).padStart(3, '0')}`,
      cliente_id: veiculo.cliente_id,
      veiculo_id: veiculo.id,
      tipo_lavagem_id: tipo.id,
      status,
      valor: tipo.preco,
      data,
      user_id: adminId,
      pagamento,
      observacao: '',
      data_conclusao: status === 'concluida' ? data : null,
    });
  }
}

// Adicionar algumas lavagens pendentes e em andamento recentes
lavagens.push(
  { id: 'lav-100', cliente_id: 'cli-001', veiculo_id: 'vei-001', tipo_lavagem_id: 'tl-001', status: 'pendente', valor: 25.00, data: getNow(), user_id: adminId, pagamento: 'Pendente', observacao: '', data_conclusao: null },
  { id: 'lav-101', cliente_id: 'cli-002', veiculo_id: 'vei-002', tipo_lavagem_id: 'tl-002', status: 'pendente', valor: 45.00, data: getNow(), user_id: adminId, pagamento: 'Pendente', observacao: '', data_conclusao: null },
  { id: 'lav-102', cliente_id: 'cli-005', veiculo_id: 'vei-005', tipo_lavagem_id: 'tl-003', status: 'em_progresso', valor: 80.00, data: getNow(), user_id: adminId, pagamento: 'PIX', observacao: 'Cliente aguardando', data_conclusao: null },
);

const insertLavagem = db.prepare('INSERT INTO lavagens (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao, data_conclusao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
lavagens.forEach(l => insertLavagem.run(l.id, l.cliente_id, l.veiculo_id, l.tipo_lavagem_id, l.status, l.valor, l.data, l.user_id, l.pagamento, l.observacao, l.data_conclusao));

// Inserir movimentações
console.log('Inserindo movimentações...');
const movimentacoes = [];

for (let m = 0; m < 6; m++) {
  const data = generateRandomDate(m);
  
  // Entrada de produtos
  produtos.forEach(p => {
    if (Math.random() > 0.3) {
      movimentacoes.push({
        id: `mov-${crypto.randomUUID().slice(0, 8)}`,
        produto_id: p.id,
        tipo: 'entrada',
        quantidade: Math.floor(Math.random() * 20) + 5,
        observacao: 'Reposição mensal',
        user_id: adminId,
        data,
      });
    }
  });
  
  // Saída de produtos
  produtos.forEach(p => {
    if (Math.random() > 0.5) {
      movimentacoes.push({
        id: `mov-${crypto.randomUUID().slice(0, 8)}`,
        produto_id: p.id,
        tipo: 'saida',
        quantidade: Math.floor(Math.random() * 10) + 1,
        observacao: 'Consumo lavagens',
        user_id: adminId,
        data,
      });
    }
  });
}

const insertMovimentacao = db.prepare('INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)');
movimentacoes.forEach(m => insertMovimentacao.run(m.id, m.produto_id, m.tipo, m.quantidade, m.observacao, m.user_id, m.data));

console.log('\n=== Seed concluído com sucesso! ===\n');
console.log('Resumo dos dados inseridos:');
console.log(`- Usuários: 2 (admin e operador)`);
console.log(`- Tipos de Lavagem: ${tiposLavagem.length}`);
console.log(`- Clientes: ${clientes.length}`);
console.log(`- Veículos: ${veiculos.length}`);
console.log(`- Produtos: ${produtos.length}`);
console.log(`- Lavagens: ${lavagens.length} (inclui ${lavagens.filter(l => l.status === 'concluida').length} concluídas)`);
console.log(`- Movimentações: ${movimentacoes.length}`);

}); // end db.serialize()

db.close();