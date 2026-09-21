import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque } from '@/types';
import { TOKEN_STORAGE_KEY } from '@/utils/security';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export interface Database {
  initialize(): Promise<void>;
  
  getClientes(userId: string): Promise<Cliente[]>;
  getCliente(id: string): Promise<Cliente | null>;
  createCliente(userId: string, data: Omit<Cliente, 'id' | 'created_at' | 'user_id'>): Promise<Cliente>;
  updateCliente(id: string, data: Partial<Cliente>): Promise<Cliente>;
  deleteCliente(id: string): Promise<void>;

  getVeiculos(userId: string): Promise<Veiculo[]>;
  getVeiculosByCliente(clienteId: string): Promise<Veiculo[]>;
  createVeiculo(userId: string, data: Omit<Veiculo, 'id' | 'user_id'>): Promise<Veiculo>;
  updateVeiculo(id: string, data: Partial<Veiculo>): Promise<Veiculo>;
  deleteVeiculo(id: string): Promise<void>;

  getLavagens(userId: string): Promise<Lavagem[]>;
  getLavagensByCliente(clienteId: string): Promise<Lavagem[]>;
  createLavagem(userId: string, data: Omit<Lavagem, 'id' | 'data' | 'data_conclusao' | 'user_id'>): Promise<Lavagem>;
  updateLavagem(id: string, data: Partial<Lavagem>): Promise<Lavagem>;
  deleteLavagem(id: string): Promise<void>;

  getTiposLavagem(): Promise<TipoLavagem[]>;
  createTipoLavagem(data: Omit<TipoLavagem, 'id'>): Promise<TipoLavagem>;
  updateTipoLavagem(id: string, data: Partial<TipoLavagem>): Promise<TipoLavagem>;
  deleteTipoLavagem(id: string): Promise<void>;

  getProdutos(userId: string): Promise<Produto[]>;
  createProduto(userId: string, data: Omit<Produto, 'id' | 'user_id'>): Promise<Produto>;
  updateProduto(id: string, data: Partial<Produto>): Promise<Produto>;
  deleteProduto(id: string): Promise<void>;

  getMovimentacoes(userId: string): Promise<MovimentacaoEstoque[]>;
  createMovimentacao(userId: string, data: Omit<MovimentacaoEstoque, 'id' | 'data' | 'user_id'>): Promise<MovimentacaoEstoque>;
}

const req = async (endpoint: string, options: RequestInit & { notFoundReturnsNull?: boolean } = {}) => {
  const { notFoundReturnsNull, ...fetchOptions } = options;
  const url = `${API_URL}${endpoint}`;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers || {})
  };

  const res = await fetch(url, { ...fetchOptions, headers });
  if (res.status === 404 && notFoundReturnsNull) return null;
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
    return req(`/clientes/${id}`, { notFoundReturnsNull: true });
  },

  async createCliente(userId: string, data) {
    return req(`/clientes`, { method: 'POST', body: JSON.stringify({ ...data, user_id: userId }) });
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

  async createVeiculo(userId: string, data) {
    return req(`/veiculos`, { method: 'POST', body: JSON.stringify({ ...data, user_id: userId }) });
  },

  async updateVeiculo(id, data) {
    return req(`/veiculos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
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

  async createLavagem(userId: string, data) {
    return req(`/lavagens`, { method: 'POST', body: JSON.stringify({ ...data, user_id: userId }) });
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

  async createProduto(userId: string, data) {
    return req(`/produtos`, { method: 'POST', body: JSON.stringify({ ...data, user_id: userId }) });
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

  async createMovimentacao(userId: string, data) {
    return req(`/movimentacoes`, { method: 'POST', body: JSON.stringify({ ...data, user_id: userId }) });
  },

  async createMovimentacaoWithUpdate(userId: string, data) {
    return req(`/movimentacoes`, { method: 'POST', body: JSON.stringify({ ...data, user_id: userId }) });
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
  const token = getToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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