import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  deleteVeiculo(id: string): Promise<void>;

  getLavagens(userId: string): Promise<Lavagem[]>;
  getLavagensByCliente(clienteId: string): Promise<Lavagem[]>;
  createLavagem(data: Omit<Lavagem, 'id' | 'data' | 'data_conclusao'>): Promise<Lavagem>;
  updateLavagem(id: string, data: Partial<Lavagem>): Promise<Lavagem>;
  deleteLavagem(id: string): Promise<void>;

  getTiposLavagem(): Promise<TipoLavagem[]>;
  createTipoLavagem(data: Omit<TipoLavagem, 'id'>): Promise<TipoLavagem>;
  updateTipoLavagem(id: string, data: Partial<TipoLavagem>): Promise<TipoLavagem>;
  deleteTipoLavagem(id: string): Promise<void>;

  getProdutos(userId: string): Promise<Produto[]>;
  createProduto(data: Omit<Produto, 'id'>): Promise<Produto>;
  updateProduto(id: string, data: Partial<Produto>): Promise<Produto>;
  deleteProduto(id: string): Promise<void>;

  getMovimentacoes(userId: string): Promise<MovimentacaoEstoque[]>;
  createMovimentacao(data: Omit<MovimentacaoEstoque, 'id' | 'data'>): Promise<MovimentacaoEstoque>;
}

const req = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `Erro HTTP: ${res.status}`);
  }
  return res.json();
};

export const apiDB: Database = {
  async initialize() {
    // API is stateless, nothing to initialize for DB layer usually
  },

  async getClientes(userId: string) {
    return req(`/clientes?user_id=${userId}`);
  },

  async getCliente(id: string) {
    const clientes = await req(`/clientes`);
    return clientes.find((c: Cliente) => c.id === id) || null;
  },

  async createCliente(data) {
    return req(`/clientes`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateCliente(id, data) {
    return req(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteCliente(id) {
    await req(`/clientes/${id}`, { method: 'DELETE' });
  },

  async getVeiculos(userId: string) {
    return req(`/veiculos?user_id=${userId}`);
  },

  async getVeiculosByCliente(clienteId: string) {
    return req(`/veiculos?cliente_id=${clienteId}`);
  },

  async createVeiculo(data) {
    return req(`/veiculos`, { method: 'POST', body: JSON.stringify(data) });
  },

  async deleteVeiculo(id) {
    await req(`/veiculos/${id}`, { method: 'DELETE' });
  },

  async getLavagens(userId: string) {
    return req(`/lavagens?user_id=${userId}`);
  },

  async getLavagensByCliente(clienteId: string) {
    return req(`/lavagens?cliente_id=${clienteId}`);
  },

  async createLavagem(data) {
    return req(`/lavagens`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateLavagem(id, data) {
    return req(`/lavagens/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteLavagem(id) {
    await req(`/lavagens/${id}`, { method: 'DELETE' });
  },

  async getTiposLavagem() {
    return req(`/tipos-lavagem`);
  },

  async createTipoLavagem(data) {
    return req(`/tipos-lavagem`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateTipoLavagem(id, data) {
    return req(`/tipos-lavagem/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteTipoLavagem(id) {
    await req(`/tipos-lavagem/${id}`, { method: 'DELETE' });
  },

  async getProdutos(userId: string) {
    return req(`/produtos?user_id=${userId}`);
  },

  async createProduto(data) {
    return req(`/produtos`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateProduto(id, data) {
    return req(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteProduto(id) {
    await req(`/produtos/${id}`, { method: 'DELETE' });
  },

  async getMovimentacoes(userId: string) {
    return req(`/movimentacoes?user_id=${userId}`);
  },

  async createMovimentacao(data) {
    return req(`/movimentacoes`, { method: 'POST', body: JSON.stringify(data) });
  },
};

export function getDatabase(): Database {
  return apiDB;
}

// Backup Functions
export const exportBackup = async () => {
  return req('/backup/export');
};

export const importBackup = async (formData: FormData) => {
  const url = `${API_URL}/backup/import`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    // Note: Do not set Content-Type header when sending FormData,
    // browser will automatically set it to multipart/form-data with boundary
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `Erro HTTP: ${res.status}`);
  }
  return res.json();
};

export const resetDatabase = async () => {
  return req('/backup/reset', { method: 'POST' });
};