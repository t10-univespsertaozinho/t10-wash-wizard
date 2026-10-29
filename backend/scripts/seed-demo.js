/**
 * Massa fictícia para demonstração, sem apagar ou alterar registros reais.
 * Por padrão somente exibe a massa planejada e os IDs já presentes.
 * Uso: npm run db:seed:demo [-- --apply]
 */
import crypto from 'node:crypto';
import { dbReady, pool } from '../db.js';

const APPLY = process.argv.slice(2).includes('--apply');
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--apply');
if (unknownArgs.length) throw new Error(`Argumentos desconhecidos: ${unknownArgs.join(' ')}`);

const CLIENT_NAMES = [
  'Mariana Alves', 'Rafael Oliveira', 'Camila Santos', 'Lucas Ferreira', 'Beatriz Costa',
  'Gabriel Rodrigues', 'Juliana Martins', 'Matheus Souza', 'Larissa Pereira', 'Felipe Lima',
  'Amanda Carvalho', 'Bruno Gomes', 'Isabela Ribeiro', 'Thiago Almeida', 'Letícia Barbosa',
  'Pedro Nascimento', 'Ana Clara Lopes', 'Gustavo Araújo', 'Sofia Fernandes', 'Vinícius Rocha',
  'Eduarda Dias', 'Leonardo Teixeira', 'Carolina Moreira', 'Henrique Correia', 'Manuela Mendes',
  'Daniel Freitas', 'Vitória Cardoso', 'João Pedro Batista', 'Luana Campos', 'André Monteiro',
  'Heloísa Cunha', 'Diego Pinto', 'Natália Vieira', 'Caio Moraes', 'Yasmin Castro',
  'Rodrigo Farias', 'Clara Barros', 'Samuel Pires', 'Isadora Melo', 'Marcelo Tavares',
  'Bianca Rezende', 'Eduardo Neves', 'Laura Machado', 'Ricardo Azevedo', 'Elisa Fonseca',
];
const MODELS = [
  ['Chevrolet', 'Onix LT'], ['Hyundai', 'HB20 Comfort'], ['Volkswagen', 'Polo TSI'],
  ['Volkswagen', 'Gol 1.6'], ['Toyota', 'Corolla XEi'], ['Honda', 'Civic EX'],
  ['Jeep', 'Compass Longitude'], ['Hyundai', 'Creta Platinum'], ['Jeep', 'Renegade Sport'],
  ['Fiat', 'Strada Freedom'], ['Toyota', 'Hilux SRV'], ['Fiat', 'Argo Trekking'],
  ['Renault', 'Kwid Intense'], ['Nissan', 'Kicks Advance'], ['Chevrolet', 'Tracker LT'],
  ['Honda', 'City EX'], ['Fiat', 'Toro Endurance'], ['Ford', 'Ka SE'],
];
const COLORS = ['Prata', 'Branco', 'Preto', 'Cinza', 'Vermelho', 'Azul', 'Branco perolizado'];
const SERVICES = [
  { id: 'demo-tipo-simples', nome: 'Ducha Rápida / Simples', descricao: 'Lavagem externa rápida. Duração média: 35 min.', preco: 42, minutos: 35 },
  { id: 'demo-tipo-completa', nome: 'Completa (interna + externa)', descricao: 'Lavagem interna e externa. Duração média: 60 min.', preco: 75, minutos: 60 },
  { id: 'demo-tipo-higienizacao', nome: 'Higienização Interna / Bancos', descricao: 'Higienização de bancos e interior. Duração média: 120 min.', preco: 220, minutos: 120 },
  { id: 'demo-tipo-chassi', nome: 'Lavagem de Chassi / Motor', descricao: 'Limpeza técnica. Duração média: 50 min.', preco: 100, minutos: 50 },
  { id: 'demo-tipo-cera', nome: 'Cera / Polimento Comercial', descricao: 'Cera e polimento comercial. Duração média: 90 min.', preco: 160, minutos: 90 },
];
const PRODUCTS = [
  { nome: 'Shampoo Automotivo Concentrado (Galão 5L)', unidade: 'L', categoria: 'Limpeza', preco: 18, minimo: 8 },
  { nome: 'Cera Líquida', unidade: 'L', categoria: 'Acabamento', preco: 42, minimo: 3 },
  { nome: 'Pretinho para Pneus', unidade: 'L', categoria: 'Acabamento', preco: 16, minimo: 4 },
  { nome: 'Desengraxante Multiuso', unidade: 'L', categoria: 'Limpeza', preco: 14, minimo: 4 },
  { nome: 'Aromatizante / Odorizador', unidade: 'un', categoria: 'Acabamento', preco: 5, minimo: 12 },
  { nome: 'Luvas de Microfibra', unidade: 'un', categoria: 'Acessórios', preco: 12, minimo: 4 },
  { nome: 'Panos de Microfibra', unidade: 'un', categoria: 'Acessórios', preco: 8, minimo: 20 },
  { nome: 'Limpa-estofados', unidade: 'L', categoria: 'Limpeza', preco: 22, minimo: 3 },
  { nome: 'Silicone para Painel', unidade: 'L', categoria: 'Acabamento', preco: 19, minimo: 3 },
  { nome: 'Pretinho Concentrado', unidade: 'L', categoria: 'Acabamento', preco: 21, minimo: 3 },
];

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest();
const int = (value, mod) => hash(value).readUInt32BE(0) % mod;
const demoId = (prefix, value) => `demo-${prefix}-${value}`;
const ymd = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
function localToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(`${part.year}-${part.month}-${part.day}T00:00:00Z`);
}
const fromSqlLocal = (date, minute) => {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return new Date(`${date}T${hh}:${mm}:00-03:00`).toISOString();
};
function localMinuteNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Number(part.hour) * 60 + Number(part.minute);
}

const today = localToday();
const start = addDays(today, -179);
const dateList = Array.from({ length: 180 }, (_, day) => addDays(start, day));
const rainyDays = new Set(dateList.filter((date) => int(`chuva:${ymd(date)}`, 100) < 3).map(ymd));
const isOpen = (date) => date.getUTCDay() !== 0 && !rainyDays.has(ymd(date));
const nextOpenDay = (date) => {
  let candidate = date;
  for (let guard = 0; guard < 8 && !isOpen(candidate); guard += 1) candidate = addDays(candidate, 1);
  return candidate;
};

const clients = CLIENT_NAMES.map((nome, index) => ({
  id: demoId('cliente', String(index + 1).padStart(3, '0')),
  nome,
  telefone: `(16) 9${String(81000000 + index).padStart(8, '0')}`,
  data_nascimento: `${1980 + (index % 23)}-${String(1 + (index * 7) % 12).padStart(2, '0')}-${String(1 + (index * 11) % 27).padStart(2, '0')}`,
  created_at: fromSqlLocal(ymd(start), 8 * 60),
}));

// 14 fiéis (31%), 18 ocasionais (40%) e 13 de visita única (29%).
const faithfulCount = 14;
const occasionalEnd = 32;
const vehicles = [];
for (let index = 0; index < clients.length; index += 1) {
  const vehicleCount = index < 7 ? 2 : 1; // 52 veículos, com carros de família/trabalho.
  for (let owned = 0; owned < vehicleCount; owned += 1) {
    const vehicleIndex = vehicles.length;
    const [marca, modelo] = MODELS[vehicleIndex % MODELS.length];
    const mercosul = vehicleIndex % 2 === 0;
    const letters = ['F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q'];
    const plate = mercosul
      ? `${letters[vehicleIndex % letters.length]}${String.fromCharCode(65 + vehicleIndex % 26)}${String.fromCharCode(65 + (vehicleIndex * 3) % 26)}${vehicleIndex % 10}${String.fromCharCode(65 + (vehicleIndex * 7) % 26)}${String(vehicleIndex % 100).padStart(2, '0')}`
      : `${letters[vehicleIndex % letters.length]}${String.fromCharCode(65 + vehicleIndex % 26)}${String.fromCharCode(65 + (vehicleIndex * 3) % 26)}${String(vehicleIndex % 10)}${String((vehicleIndex * 13) % 1000).padStart(3, '0')}`;
    vehicles.push({
      id: demoId('veiculo', String(vehicleIndex + 1).padStart(3, '0')),
      cliente_id: clients[index].id,
      modelo,
      placa: plate,
      cor: COLORS[vehicleIndex % COLORS.length],
      marca,
      created_at: fromSqlLocal(ymd(start), 8 * 60),
    });
  }
}
const clientsVehicles = new Map(clients.map((client) => [client.id, vehicles.filter((vehicle) => vehicle.cliente_id === client.id)]));

const visits = [];
for (let index = 0; index < clients.length; index += 1) {
  const client = clients[index];
  let count;
  if (index < faithfulCount) count = 8 + (index % 3); // 8–10 visitas, intervalos de 15–30 dias.
  else if (index < occasionalEnd) count = 2 + (index % 3); // 2–4 visitas.
  else count = 1;

  let offsets;
  if (index < faithfulCount) {
    const endOffset = index < 8 ? 179 : 178;
    const baseGap = Math.floor(endOffset / (count - 1));
    const gaps = Array.from({ length: count - 1 }, (_, visitIndex) => baseGap + int(`gap:${index}:${visitIndex}`, 5) - 2);
    let overflow = gaps.reduce((sum, gap) => sum + gap, 0) - 179;
    for (let gapIndex = gaps.length - 1; overflow > 0 && gapIndex >= 0; gapIndex -= 1) {
      const reduction = Math.min(overflow, gaps[gapIndex] - 15);
      gaps[gapIndex] -= reduction;
      overflow -= reduction;
    }
    offsets = [Math.max(0, endOffset - gaps.reduce((sum, gap) => sum + gap, 0))];
    for (const gap of gaps) offsets.push(offsets.at(-1) + gap);
    offsets = offsets.map((offset) => Math.min(endOffset, offset));
  } else {
    const uniqueOffsets = new Set();
    for (let visitIndex = 0; uniqueOffsets.size < count; visitIndex += 1) uniqueOffsets.add(int(`visit:${index}:${visitIndex}`, 180));
    offsets = [...uniqueOffsets].sort((a, b) => a - b);
  }

  offsets.forEach((offset, visitIndex) => {
    const intended = addDays(start, offset);
    let scheduled = isOpen(intended) ? intended : nextOpenDay(intended);
    if (scheduled > today) scheduled = isOpen(today) ? today : dateList.slice().reverse().find(isOpen);
    const serviceRoll = int(`service:${index}:${visitIndex}`, 100);
    const service = ymd(scheduled) === ymd(today)
      ? (serviceRoll % 2 ? SERVICES[0] : SERVICES[1])
      : serviceRoll < 50 ? SERVICES[0] : serviceRoll < 80 ? SERVICES[1] : serviceRoll < 88 ? SERVICES[2] : serviceRoll < 94 ? SERVICES[3] : SERVICES[4];
    const ownedVehicles = clientsVehicles.get(client.id);
    visits.push({
      id: demoId('lavagem', `${String(index + 1).padStart(3, '0')}-${String(visitIndex + 1).padStart(2, '0')}`),
      cliente_id: client.id,
      veiculo_id: ownedVehicles[int(`vehicle:${index}:${visitIndex}`, ownedVehicles.length)].id,
      tipo_lavagem_id: service.id,
      service,
      date: ymd(scheduled),
      status: 'concluida',
      pagamento: 'Pendente',
      observacao: null,
      lane: 0,
      startMinute: 480,
    });
  });
}

// Distribui serviços em no máximo dois boxes por dia, respeitando 08h–18h.
visits.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const lanesByDate = new Map();
for (const visit of visits) {
  let schedule = lanesByDate.get(visit.date) || [480, 480];
  let lane = schedule[0] <= schedule[1] ? 0 : 1;
  if (schedule[lane] + visit.service.minutos > 1080) {
    let date = nextOpenDay(addDays(new Date(`${visit.date}T00:00:00Z`), 1));
    while (lanesByDate.has(ymd(date)) && lanesByDate.get(ymd(date)).every((time) => time >= 1080)) date = nextOpenDay(addDays(date, 1));
    visit.date = ymd(date);
    schedule = lanesByDate.get(visit.date) || [480, 480];
    lane = schedule[0] <= schedule[1] ? 0 : 1;
  }
  visit.lane = lane + 1;
  visit.startMinute = schedule[lane];
  schedule[lane] += visit.service.minutos;
  lanesByDate.set(visit.date, schedule);
}

// Mantém alguns horários vivos no dia da execução, sem deslocar a operação
// para fora do expediente. A reserva futura permanece como status pendente.
const todayVisits = visits.filter((visit) => visit.date === ymd(today));
if (todayVisits.length) {
  const minuteNow = Math.min(17 * 60 + 20, Math.max(8 * 60, localMinuteNow()));
  const laneFree = [minuteNow - 20, minuteNow];
  todayVisits[0].status = 'em_progresso';
  todayVisits[0].startMinute = Math.max(8 * 60, Math.min(minuteNow - 20, 17 * 60));
  laneFree[0] = todayVisits[0].startMinute + todayVisits[0].service.minutos;
  for (const visit of todayVisits.slice(1)) {
    visit.status = 'pendente';
    const lane = laneFree[0] <= laneFree[1] ? 0 : 1;
    visit.lane = lane + 1;
    visit.startMinute = Math.max(minuteNow, laneFree[lane]);
    laneFree[lane] = visit.startMinute + visit.service.minutos;
  }
}

// Seleção estável de cancelamentos, aproximadamente 4% do total histórico.
const cancelCount = Math.round(visits.length * 0.04);
const cancelCandidates = visits
  .filter((visit) => visit.status === 'concluida' && visit.date < ymd(addDays(today, -2)))
  .sort((a, b) => int(`cancel:${a.id}`, 0x100000000) - int(`cancel:${b.id}`, 0x100000000));
for (const visit of cancelCandidates.slice(0, cancelCount)) {
  visit.status = 'cancelada';
  visit.observacao = int(`motivo:${visit.id}`, 2) === 0 ? 'Demonstração: cancelada por chuva.' : 'Demonstração: cliente desistiu do horário.';
}
const paymentNames = ['PIX', 'Débito', 'Crédito', 'Dinheiro'];
const paymentBands = [55, 80, 95, 100];
for (const visit of visits) {
  const paymentRoll = int(`payment:${visit.id}`, 100);
  visit.pagamento = visit.status === 'concluida'
    ? paymentNames[paymentBands.findIndex((band) => paymentRoll < band)]
    : 'Pendente';
  visit.data = fromSqlLocal(visit.date, visit.startMinute);
  visit.data_conclusao = visit.status === 'concluida'
    ? new Date(new Date(visit.data).getTime() + visit.service.minutos * 60000).toISOString()
    : null;
  if (visit.status !== 'cancelada' && visit.status !== 'concluida') {
    visit.observacao = `Demonstração: Box ${visit.lane}, duração estimada ${visit.service.minutos} min.`;
  } else if (visit.status === 'concluida') {
    visit.observacao = `Demonstração: Box ${visit.lane}, duração estimada ${visit.service.minutos} min.`;
  }
}

const productRows = PRODUCTS.map((product, index) => ({
  id: demoId('produto', String(index + 1).padStart(2, '0')),
  nome: product.nome,
  quantidade: 0,
  estoque_minimo: product.minimo,
  categoria: product.categoria,
  unidade: product.unidade,
  preco_unitario: product.preco,
  created_at: fromSqlLocal(ymd(start), 7 * 60),
}));
const consumptionFor = (visit) => {
  const usage = { 0: 0.06, 1: 0.1, 2: 0.08, 3: 0.06, 4: 0.05, 5: 0.025, 6: 0.08, 7: 0.04, 8: 0.02, 9: 0.035 };
  const selected = visit.status === 'cancelada' ? [] : [0, 2, 5, 6];
  if ([SERVICES[2].id, SERVICES[3].id, SERVICES[4].id].includes(visit.tipo_lavagem_id)) selected.push(1, 3, 7, 8, 9);
  if (visit.tipo_lavagem_id === SERVICES[2].id) selected.push(4);
  return [...new Set(selected)].map((index) => [index, usage[index] * (visit.tipo_lavagem_id === SERVICES[2].id ? 1.8 : 1)]);
};

const movementRows = [];
const stockBalance = productRows.map(() => 0);
const consumptionByBucket = new Map();
for (const visit of visits) {
  if (visit.status === 'cancelada') continue;
  const bucket = Math.floor((Date.parse(`${visit.date}T00:00:00Z`) - start.getTime()) / (30 * 86400000));
  for (const [productIndex, quantity] of consumptionFor(visit)) {
    const key = `${bucket}:${productIndex}`;
    consumptionByBucket.set(key, (consumptionByBucket.get(key) || 0) + quantity);
    movementRows.push({
      id: demoId('mov-saida', `${visit.id}-${String(productIndex + 1).padStart(2, '0')}`),
      produto_id: productRows[productIndex].id,
      tipo: 'saida',
      quantidade: Number(quantity.toFixed(3)),
      observacao: `Demonstração: consumo da lavagem ${visit.id}.`,
      user_id: null,
      data: visit.data,
    });
    stockBalance[productIndex] -= quantity;
  }
}
for (let bucket = 0; bucket < 6; bucket += 1) {
  const bucketStart = addDays(start, bucket * 30);
  for (let productIndex = 0; productIndex < productRows.length; productIndex += 1) {
    const used = consumptionByBucket.get(`${bucket}:${productIndex}`) || 0;
    const quantity = Number((used + (bucket === 0 ? PRODUCTS[productIndex].minimo : 0)).toFixed(3));
    movementRows.push({
      id: demoId('mov-entrada', `${bucket + 1}-${String(productIndex + 1).padStart(2, '0')}`),
      produto_id: productRows[productIndex].id,
      tipo: 'entrada',
      quantidade: quantity,
      observacao: `Demonstração: reposição periódica de insumos, período ${bucket + 1}.`,
      user_id: null,
      data: fromSqlLocal(ymd(bucketStart), 7 * 60),
    });
    stockBalance[productIndex] += quantity;
  }
}
productRows.forEach((product, index) => { product.quantidade = Number(stockBalance[index].toFixed(3)); });

const washRows = visits.map(({ id, cliente_id, veiculo_id, tipo_lavagem_id, status, service, data, data_conclusao, pagamento, observacao }) => ({
  id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor: service.preco, data,
  user_id: null, pagamento, observacao, data_conclusao,
}));
const auditRows = washRows.map((wash) => ({
  id: demoId('audit', wash.id),
  lavagem_id: wash.id,
  acao: 'criacao_demo',
  dados_anteriores: null,
  dados_novos: JSON.stringify({ status: wash.status, valor: wash.valor, pagamento: wash.pagamento, demo: true }),
  user_id: null,
  data: wash.data,
  campo: null,
  valor_anterior: null,
  valor_novo: null,
}));

const planned = [
  ['tipos_lavagem', SERVICES.length], ['clientes', clients.length], ['veiculos', vehicles.length],
  ['produtos', productRows.length], ['lavagens', washRows.length], ['movimentacoes', movementRows.length],
  ['auditoria_lavagens', auditRows.length],
];
const operatingDays = [...new Set(visits.map((visit) => visit.date))];
const dailyCounts = new Map();
for (const visit of visits) dailyCounts.set(visit.date, (dailyCounts.get(visit.date) || 0) + 1);
const columns = {
  tipos_lavagem: ['id', 'nome', 'descricao', 'preco', 'created_at'],
  clientes: ['id', 'user_id', 'nome', 'telefone', 'data_nascimento', 'created_at'],
  veiculos: ['id', 'cliente_id', 'user_id', 'modelo', 'placa', 'cor', 'marca', 'created_at'],
  produtos: ['id', 'nome', 'quantidade', 'estoque_minimo', 'categoria', 'unidade', 'preco_unitario', 'user_id', 'created_at'],
  lavagens: ['id', 'cliente_id', 'veiculo_id', 'tipo_lavagem_id', 'status', 'valor', 'data', 'user_id', 'pagamento', 'observacao', 'data_conclusao'],
  movimentacoes: ['id', 'produto_id', 'tipo', 'quantidade', 'observacao', 'user_id', 'data'],
  auditoria_lavagens: ['id', 'lavagem_id', 'acao', 'dados_anteriores', 'dados_novos', 'user_id', 'data', 'campo', 'valor_anterior', 'valor_novo'],
};
const rows = {
  tipos_lavagem: SERVICES.map(({ id, nome, descricao, preco }) => ({ id, nome, descricao, preco, created_at: fromSqlLocal(ymd(start), 7 * 60) })),
  clientes: clients.map((client) => ({ ...client, user_id: null })),
  veiculos: vehicles.map((vehicle) => ({ ...vehicle, user_id: null })),
  produtos: productRows,
  lavagens: washRows,
  movimentacoes: movementRows,
  auditoria_lavagens: auditRows,
};

async function upsertBatch(client, table, batch) {
  const tableColumns = columns[table];
  const params = [];
  const values = batch.map((row, rowIndex) => {
    const placeholders = tableColumns.map((column, columnIndex) => {
      params.push(row[column] ?? null);
      return `$${rowIndex * tableColumns.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  const update = tableColumns.filter((column) => column !== 'id').map((column) => `${column} = EXCLUDED.${column}`).join(', ');
  await client.query(`INSERT INTO ${table} (${tableColumns.join(', ')}) VALUES ${values.join(', ')} ON CONFLICT (id) DO UPDATE SET ${update}`, params);
}

try {
  await dbReady;
  console.log(`Janela: ${ymd(start)} a ${ymd(today)} (America/Sao_Paulo)`);
  console.log(`Perfil: ${faithfulCount} fiéis, ${occasionalEnd - faithfulCount} ocasionais, ${clients.length - occasionalEnd} esporádicos.`);
  console.log(`Dias simulados com chuva e sem operação: ${rainyDays.size}; domingos fechados.`);
  console.log(`Lavagens planejadas: ${washRows.length} (${(washRows.length / 180).toFixed(2)}/dia corrido; recorrência selecionada limita o volume abaixo de 500–750).`);
  console.log(`Operação: ${operatingDays.length} dias, média ${(washRows.length / operatingDays.length).toFixed(2)} lavagens/dia aberto, pico ${Math.max(...dailyCounts.values())}; máximo de 2 boxes, 08h–18h.`);
  console.log(`Mix status: ${JSON.stringify(washRows.reduce((counts, wash) => ({ ...counts, [wash.status]: (counts[wash.status] || 0) + 1 }), {}))}`);
  console.log(`Modo: ${APPLY ? 'APLICAÇÃO' : 'PRÉVIA SEM ESCRITA'}`);

  const existing = {};
  for (const [table] of planned) {
    const result = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE id LIKE 'demo-%'`);
    existing[table] = result.rows[0].n;
  }
  for (const [table, count] of planned) console.log(`${table}: planejados=${count}, IDs demo atuais=${existing[table]}`);

  if (APPLY) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [table] of planned) {
        const tableRows = rows[table];
        for (let offset = 0; offset < tableRows.length; offset += 100) {
          await upsertBatch(client, table, tableRows.slice(offset, offset + 100));
        }
      }
      await client.query('COMMIT');
      console.log('Aplicação concluída em uma transação; os dados fora do namespace demo-* não foram alterados.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} catch (error) {
  console.error('Falha no seed de demonstração:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
