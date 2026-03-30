import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque } from '@/types';

const STORAGE_KEY = 't10_state';

export type DatabaseType = 'localstorage' | 'firebase' | 'supabase';

export interface DatabaseConfig {
  type: DatabaseType;
}

export interface Database {
  initialize(): Promise<void>;
  
  getClientes(userId: string): Promise<Cliente[]>;
  getCliente(id: string): Promise<Cliente | null>;
  createCliente(data: Omit<Cliente, 'id' | 'created_at'>): Promise<Cliente>;
  updateCliente(id: string, data: Partial<Cliente>): Promise<Cliente>;
  deleteCliente(id: string): Promise<void>;

  getVeiculos(userId: string): Promise<Veiculo[]>;
  getVeiculosByCliente(clienteId: string): Promise<Veiculo[]>;
  createVeiculo(data: Omit<Veiculo, 'id'>): Promise<Veiculo>;
  updateVeiculo(id: string, data: Partial<Veiculo>): Promise<Veiculo>;
  deleteVeiculo(id: string): Promise<void>;

  getLavagens(userId: string): Promise<Lavagem[]>;
  getLavagensByCliente(clienteId: string): Promise<Lavagem[]>;
  createLavagem(data: Omit<Lavagem, 'id' | 'data' | 'data_conclusao'>): Promise<Lavagem>;
  updateLavagem(id: string, data: Partial<Lavagem>): Promise<Lavagem>;
  deleteLavagem(id: string): Promise<void>;

  getTiposLavagem(): Promise<TipoLavagem[]>;
  createTipoLavagem(data: Omit<TipoLavagem, 'id'>): Promise<TipoLavagem>;
  deleteTipoLavagem(id: string): Promise<void>;

  getProdutos(userId: string): Promise<Produto[]>;
  createProduto(data: Omit<Produto, 'id'>): Promise<Produto>;
  updateProduto(id: string, data: Partial<Produto>): Promise<Produto>;
  deleteProduto(id: string): Promise<void>;

  getMovimentacoes(userId: string): Promise<MovimentacaoEstoque[]>;
  createMovimentacao(data: Omit<MovimentacaoEstoque, 'id' | 'data'>): Promise<MovimentacaoEstoque>;
}

const genId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

const defaultTipos: TipoLavagem[] = [
  { id: genId(), nome: 'Lavagem Simples', descricao: 'Lavagem externa com água e sabão', preco: 25 },
  { id: genId(), nome: 'Lavagem Completa', descricao: 'Lavagem interna e externa completa', preco: 45 },
  { id: genId(), nome: 'Polimento', descricao: 'Polimento completo da pintura', preco: 80 },
  { id: genId(), nome: 'Lavagem a Seco', descricao: 'Lavagem ecológica sem uso de água', preco: 35 },
];

interface StorageState {
  clientes: Cliente[];
  veiculos: Veiculo[];
  tiposLavagem: TipoLavagem[];
  lavagens: Lavagem[];
  produtos: Produto[];
  movimentacoes: MovimentacaoEstoque[];
}

function loadState(): StorageState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {
    // Silent fail - return default state
  }
  return {
    clientes: [],
    veiculos: [],
    tiposLavagem: defaultTipos,
    lavagens: [],
    produtos: [],
    movimentacoes: [],
  };
}

function saveState(state: StorageState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const localStorageDB: Database = {
  async initialize() {
    const state = loadState();
    if (state.tiposLavagem.length === 0) {
      state.tiposLavagem = defaultTipos;
      saveState(state);
    }
  },

  async getClientes(userId: string) {
    const state = loadState();
    return state.clientes.filter(c => c.user_id === userId);
  },

  async getCliente(id: string) {
    const state = loadState();
    return state.clientes.find(c => c.id === id) || null;
  },

  async createCliente(data) {
    const state = loadState();
    const novo: Cliente = { ...data, id: genId(), created_at: now() };
    state.clientes.push(novo);
    saveState(state);
    return novo;
  },

  async updateCliente(id, data) {
    const state = loadState();
    const idx = state.clientes.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Cliente não encontrado');
    state.clientes[idx] = { ...state.clientes[idx], ...data };
    saveState(state);
    return state.clientes[idx];
  },

  async deleteCliente(id) {
    const state = loadState();
    state.clientes = state.clientes.filter(c => c.id !== id);
    state.veiculos = state.veiculos.filter(v => v.cliente_id !== id);
    state.lavagens = state.lavagens.filter(l => l.cliente_id !== id);
    saveState(state);
  },

  async getVeiculos(userId: string) {
    const state = loadState();
    return state.veiculos.filter(v => v.user_id === userId);
  },

  async getVeiculosByCliente(clienteId: string) {
    const state = loadState();
    return state.veiculos.filter(v => v.cliente_id === clienteId);
  },

  async createVeiculo(data) {
    const state = loadState();
    const novo: Veiculo = { ...data, id: genId() };
    state.veiculos.push(novo);
    saveState(state);
    return novo;
  },

  async updateVeiculo(id, data) {
    const state = loadState();
    const idx = state.veiculos.findIndex(v => v.id === id);
    if (idx === -1) throw new Error('Veículo não encontrado');
    state.veiculos[idx] = { ...state.veiculos[idx], ...data };
    saveState(state);
    return state.veiculos[idx];
  },

  async deleteVeiculo(id) {
    const state = loadState();
    state.veiculos = state.veiculos.filter(v => v.id !== id);
    saveState(state);
  },

  async getLavagens(userId: string) {
    const state = loadState();
    return state.lavagens.filter(l => l.user_id === userId);
  },

  async getLavagensByCliente(clienteId: string) {
    const state = loadState();
    return state.lavagens.filter(l => l.cliente_id === clienteId);
  },

  async createLavagem(data) {
    const state = loadState();
    const novo: Lavagem = { ...data, id: genId(), data: now(), data_conclusao: null };
    state.lavagens.push(novo);
    saveState(state);
    return novo;
  },

  async updateLavagem(id, data) {
    const state = loadState();
    const idx = state.lavagens.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Lavagem não encontrada');
    state.lavagens[idx] = { ...state.lavagens[idx], ...data };
    saveState(state);
    return state.lavagens[idx];
  },

  async deleteLavagem(id) {
    const state = loadState();
    state.lavagens = state.lavagens.filter(l => l.id !== id);
    saveState(state);
  },

  async getTiposLavagem() {
    const state = loadState();
    return state.tiposLavagem;
  },

  async createTipoLavagem(data) {
    const state = loadState();
    const novo: TipoLavagem = { ...data, id: genId() };
    state.tiposLavagem.push(novo);
    saveState(state);
    return novo;
  },

  async deleteTipoLavagem(id) {
    const state = loadState();
    state.tiposLavagem = state.tiposLavagem.filter(t => t.id !== id);
    saveState(state);
  },

  async getProdutos(userId: string) {
    const state = loadState();
    return state.produtos.filter(p => p.user_id === userId);
  },

  async createProduto(data) {
    const state = loadState();
    const novo: Produto = { ...data, id: genId() };
    state.produtos.push(novo);
    saveState(state);
    return novo;
  },

  async updateProduto(id, data) {
    const state = loadState();
    const idx = state.produtos.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Produto não encontrado');
    state.produtos[idx] = { ...state.produtos[idx], ...data };
    saveState(state);
    return state.produtos[idx];
  },

  async deleteProduto(id) {
    const state = loadState();
    state.produtos = state.produtos.filter(p => p.id !== id);
    saveState(state);
  },

  async getMovimentacoes(userId: string) {
    const state = loadState();
    return state.movimentacoes.filter(m => m.user_id === userId);
  },

  async createMovimentacao(data) {
    const state = loadState();
    const novo: MovimentacaoEstoque = { ...data, id: genId(), data: now() };
    state.movimentacoes.push(novo);
    saveState(state);
    return novo;
  },
};

export const firebaseDB: Database = {
  async initialize() {
    console.log('Firebase not configured - set VITE_DB_TYPE=firebase and configure firebase config');
  },
  async getClientes() { throw new Error('Firebase not implemented'); },
  async getCliente() { throw new Error('Firebase not implemented'); },
  async createCliente() { throw new Error('Firebase not implemented'); },
  async updateCliente() { throw new Error('Firebase not implemented'); },
  async deleteCliente() { throw new Error('Firebase not implemented'); },
  async getVeiculos() { throw new Error('Firebase not implemented'); },
  async getVeiculosByCliente() { throw new Error('Firebase not implemented'); },
  async createVeiculo() { throw new Error('Firebase not implemented'); },
  async updateVeiculo() { throw new Error('Firebase not implemented'); },
  async deleteVeiculo() { throw new Error('Firebase not implemented'); },
  async getLavagens() { throw new Error('Firebase not implemented'); },
  async getLavagensByCliente() { throw new Error('Firebase not implemented'); },
  async createLavagem() { throw new Error('Firebase not implemented'); },
  async updateLavagem() { throw new Error('Firebase not implemented'); },
  async deleteLavagem() { throw new Error('Firebase not implemented'); },
  async getTiposLavagem() { throw new Error('Firebase not implemented'); },
  async createTipoLavagem() { throw new Error('Firebase not implemented'); },
  async deleteTipoLavagem() { throw new Error('Firebase not implemented'); },
  async getProdutos() { throw new Error('Firebase not implemented'); },
  async createProduto() { throw new Error('Firebase not implemented'); },
  async updateProduto() { throw new Error('Firebase not implemented'); },
  async deleteProduto() { throw new Error('Firebase not implemented'); },
  async getMovimentacoes() { throw new Error('Firebase not implemented'); },
  async createMovimentacao() { throw new Error('Firebase not implemented'); },
};

export const supabaseDB: Database = {
  async initialize() {
    console.log('Supabase not configured - set VITE_DB_TYPE=supabase and configure supabase credentials');
  },
  async getClientes() { throw new Error('Supabase not implemented'); },
  async getCliente() { throw new Error('Supabase not implemented'); },
  async createCliente() { throw new Error('Supabase not implemented'); },
  async updateCliente() { throw new Error('Supabase not implemented'); },
  async deleteCliente() { throw new Error('Supabase not implemented'); },
  async getVeiculos() { throw new Error('Supabase not implemented'); },
  async getVeiculosByCliente() { throw new Error('Supabase not implemented'); },
  async createVeiculo() { throw new Error('Supabase not implemented'); },
  async updateVeiculo() { throw new Error('Supabase not implemented'); },
  async deleteVeiculo() { throw new Error('Supabase not implemented'); },
  async getLavagens() { throw new Error('Supabase not implemented'); },
  async getLavagensByCliente() { throw new Error('Supabase not implemented'); },
  async createLavagem() { throw new Error('Supabase not implemented'); },
  async updateLavagem() { throw new Error('Supabase not implemented'); },
  async deleteLavagem() { throw new Error('Supabase not implemented'); },
  async getTiposLavagem() { throw new Error('Supabase not implemented'); },
  async createTipoLavagem() { throw new Error('Supabase not implemented'); },
  async deleteTipoLavagem() { throw new Error('Supabase not implemented'); },
  async getProdutos() { throw new Error('Supabase not implemented'); },
  async createProduto() { throw new Error('Supabase not implemented'); },
  async updateProduto() { throw new Error('Supabase not implemented'); },
  async deleteProduto() { throw new Error('Supabase not implemented'); },
  async getMovimentacoes() { throw new Error('Supabase not implemented'); },
  async createMovimentacao() { throw new Error('Supabase not implemented'); },
};

export function getDatabase(): Database {
  const type = (import.meta.env.VITE_DB_TYPE as DatabaseType) || 'localstorage';
  
  switch (type) {
    case 'firebase':
      return firebaseDB;
    case 'supabase':
      return supabaseDB;
    default:
      return localStorageDB;
  }
}
