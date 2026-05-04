import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque, Conflict } from '@/types';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

const STORAGE_KEY = 't10_state';

export type DatabaseType = 'localstorage' | 'supabase';

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
    // Silent fail
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

  async updateTipoLavagem(id, data) {
    const state = loadState();
    const idx = state.tiposLavagem.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Tipo não encontrado');
    state.tiposLavagem[idx] = { ...state.tiposLavagem[idx], ...data };
    saveState(state);
    return state.tiposLavagem[idx];
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

export const supabaseDB: Database = {
  async initialize() {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase não configurado. Use localStorage.');
    }
  },

  async getClientes(userId: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('clientes').select('*').eq('user_id', userId);
    if (error) throw error;
    return data as Cliente[];
  },

  async getCliente(id: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('clientes').select('*').eq('id', id).single();
    if (error) return null;
    return data as Cliente;
  },

  async createCliente(data) {
    const db = getSupabaseClient();
    const timestamp = now();
    const novo = { ...data, created_at: timestamp, updated_at: timestamp };
    const { data: result, error } = await db.from('clientes').insert([novo]).select().single();
    if (error) throw error;
    return result as Cliente;
  },

  async updateCliente(id, data) {
    const db = getSupabaseClient();
    const { data: result, error } = await db.from('clientes').update(data).eq('id', id).select().single();
    if (error) throw error;
    return result as Cliente;
  },

  async deleteCliente(id) {
    const db = getSupabaseClient();
    const { error } = await db.from('clientes').delete().eq('id', id);
    if (error) throw error;
  },

  async getVeiculos(userId: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('veiculos').select('*').eq('user_id', userId);
    if (error) throw error;
    return data as Veiculo[];
  },

  async getVeiculosByCliente(clienteId: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('veiculos').select('*').eq('cliente_id', clienteId);
    if (error) throw error;
    return data as Veiculo[];
  },

  async createVeiculo(data) {
    const db = getSupabaseClient();
    const timestamp = now();
    const novo = { ...data, updated_at: timestamp };
    const { data: result, error } = await db.from('veiculos').insert([novo]).select().single();
    if (error) throw error;
    return result as Veiculo;
  },

  async deleteVeiculo(id) {
    const db = getSupabaseClient();
    const { error } = await db.from('veiculos').delete().eq('id', id);
    if (error) throw error;
  },

  async getLavagens(userId: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('lavagens').select('*').eq('user_id', userId).order('data', { ascending: false });
    if (error) throw error;
    return data as Lavagem[];
  },

  async getLavagensByCliente(clienteId: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('lavagens').select('*').eq('cliente_id', clienteId).order('data', { ascending: false });
    if (error) throw error;
    return data as Lavagem[];
  },

  async createLavagem(data) {
    const db = getSupabaseClient();
    const timestamp = now();
    const novo = { ...data, data: timestamp, data_conclusao: null, updated_at: timestamp };
    const { data: result, error } = await db.from('lavagens').insert([novo]).select().single();
    if (error) throw error;
    return result as Lavagem;
  },

  async updateLavagem(id, data) {
    const db = getSupabaseClient();
    const { data: result, error } = await db.from('lavagens').update(data).eq('id', id).select().single();
    if (error) throw error;
    return result as Lavagem;
  },

  async deleteLavagem(id) {
    const db = getSupabaseClient();
    const { error } = await db.from('lavagens').delete().eq('id', id);
    if (error) throw error;
  },

  async getTiposLavagem() {
    const db = getSupabaseClient();
    const { data, error } = await db.from('tipos_lavagem').select('*');
    if (error) throw error;
    if (data.length === 0) {
      const novosTipos: TipoLavagem[] = [];
      for (const tipo of defaultTipos) {
        const { id, ...rest } = tipo;
        const { data: result } = await db.from('tipos_lavagem').insert([rest]).select().single();
        if (result) novosTipos.push(result as TipoLavagem);
      }
      return novosTipos;
    }
    return data as TipoLavagem[];
  },

  async createTipoLavagem(data) {
    const db = getSupabaseClient();
    const { data: result, error } = await db.from('tipos_lavagem').insert([data]).select().single();
    if (error) throw error;
    return result as TipoLavagem;
  },

  async updateTipoLavagem(id, data) {
    const db = getSupabaseClient();
    const { data: result, error } = await db.from('tipos_lavagem').update(data).eq('id', id).select().single();
    if (error) throw error;
    return result as TipoLavagem;
  },

  async deleteTipoLavagem(id) {
    const db = getSupabaseClient();
    const { error } = await db.from('tipos_lavagem').delete().eq('id', id);
    if (error) throw error;
  },

  async getProdutos(userId: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('produtos').select('*').eq('user_id', userId);
    if (error) throw error;
    return data as Produto[];
  },

  async createProduto(data) {
    const db = getSupabaseClient();
    const timestamp = now();
    const novo = { ...data, updated_at: timestamp };
    const { data: result, error } = await db.from('produtos').insert([novo]).select().single();
    if (error) throw error;
    return result as Produto;
  },

  async updateProduto(id, data) {
    const db = getSupabaseClient();
    const { data: result, error } = await db.from('produtos').update(data).eq('id', id).select().single();
    if (error) throw error;
    return result as Produto;
  },

  async deleteProduto(id) {
    const db = getSupabaseClient();
    const { error } = await db.from('produtos').delete().eq('id', id);
    if (error) throw error;
  },

  async getMovimentacoes(userId: string) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('movimentacoes').select('*').eq('user_id', userId).order('data', { ascending: false });
    if (error) throw error;
    return data as MovimentacaoEstoque[];
  },

  async createMovimentacao(data) {
    const db = getSupabaseClient();
    const timestamp = now();
    const novo = { ...data, data: timestamp, updated_at: timestamp };
    const { data: result, error } = await db.from('movimentacoes').insert([novo]).select().single();
    if (error) throw error;
    return result as MovimentacaoEstoque;
  },
};

export function getDatabase(): Database {
  const type = getDatabaseType();
  switch (type) {
    case 'supabase':
      return supabaseDB;
    default:
      return localStorageDB;
  }
}

export function getDatabaseType(): DatabaseType {
  const savedType = localStorage.getItem('t10_db_type') as DatabaseType | null;
  if (savedType) return savedType;
  const envType = import.meta.env.VITE_DB_TYPE as DatabaseType;
  return envType === 'supabase' ? 'supabase' : 'localstorage';
}

export function isSupabaseActive(): boolean {
  return getDatabaseType() === 'supabase';
}

interface SyncResult {
  conflicts: Conflict[];
  synced: number;
  errors: string[];
}

export async function syncLocalToSupabase(
  clientes: Cliente[],
  veiculos: Veiculo[],
  lavagens: Lavagem[],
  produtos: Produto[],
  movimentacoes: MovimentacaoEstoque[],
  userId: string
): Promise<SyncResult> {
  const result: SyncResult = { conflicts: [], synced: 0, errors: [] };
  
  if (!isSupabaseConfigured()) {
    result.errors.push('Supabase não configurado');
    return result;
  }

  const db = getSupabaseClient();

  for (const cliente of clientes) {
    try {
      const { data: existing, error: findError } = await db.from('clientes').select('*').eq('id', cliente.id).single();
      
      if (existing) {
        const localUpdated = new Date(cliente.updated_at || cliente.created_at || 0).getTime();
        const remoteUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'cliente',
            entityId: cliente.id,
            localData: cliente,
            remoteData: existing as Cliente,
            localUpdatedAt: cliente.updated_at || cliente.created_at || '',
            remoteUpdatedAt: existing.updated_at || '',
          });
        } else {
          await db.from('clientes').update({
            ...cliente,
            updated_at: now(),
          }).eq('id', cliente.id);
          result.synced++;
        }
      } else {
        await db.from('clientes').insert([{
          ...cliente,
          created_at: cliente.created_at || now(),
          updated_at: now(),
        }]);
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar cliente ${cliente.id}: ${e}`);
    }
  }

  for (const veiculo of veiculos) {
    try {
      const { data: existing } = await db.from('veiculos').select('*').eq('id', veiculo.id).single();
      
      if (existing) {
        const localUpdated = new Date(veiculo.updated_at || 0).getTime();
        const remoteUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'veiculo',
            entityId: veiculo.id,
            localData: veiculo,
            remoteData: existing as Veiculo,
            localUpdatedAt: veiculo.updated_at || '',
            remoteUpdatedAt: existing.updated_at || '',
          });
        } else {
          await db.from('veiculos').update({
            ...veiculo,
            updated_at: now(),
          }).eq('id', veiculo.id);
          result.synced++;
        }
      } else {
        await db.from('veiculos').insert([{
          ...veiculo,
          updated_at: now(),
        }]);
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar veículo ${veiculo.id}: ${e}`);
    }
  }

  for (const lavagem of lavagens) {
    try {
      const { data: existing } = await db.from('lavagens').select('*').eq('id', lavagem.id).single();
      
      if (existing) {
        const localUpdated = new Date(lavagem.updated_at || lavagem.data || 0).getTime();
        const remoteUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : new Date(existing.data || 0).getTime();
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'lavagem',
            entityId: lavagem.id,
            localData: lavagem,
            remoteData: existing as Lavagem,
            localUpdatedAt: lavagem.updated_at || lavagem.data || '',
            remoteUpdatedAt: existing.updated_at || '',
          });
        } else {
          await db.from('lavagens').update({
            ...lavagem,
            updated_at: now(),
          }).eq('id', lavagem.id);
          result.synced++;
        }
      } else {
        await db.from('lavagens').insert([{
          ...lavagem,
          data: lavagem.data || now(),
          updated_at: now(),
        }]);
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar lavagem ${lavagem.id}: ${e}`);
    }
  }

  for (const produto of produtos) {
    try {
      const { data: existing } = await db.from('produtos').select('*').eq('id', produto.id).single();
      
      if (existing) {
        const localUpdated = new Date(produto.updated_at || 0).getTime();
        const remoteUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'produto',
            entityId: produto.id,
            localData: produto,
            remoteData: existing as Produto,
            localUpdatedAt: produto.updated_at || '',
            remoteUpdatedAt: existing.updated_at || '',
          });
        } else {
          await db.from('produtos').update({
            ...produto,
            updated_at: now(),
          }).eq('id', produto.id);
          result.synced++;
        }
      } else {
        await db.from('produtos').insert([{
          ...produto,
          updated_at: now(),
        }]);
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar produto ${produto.id}: ${e}`);
    }
  }

  for (const mov of movimentacoes) {
    try {
      const { data: existing } = await db.from('movimentacoes').select('*').eq('id', mov.id).single();
      
      if (!existing) {
        await db.from('movimentacoes').insert([{
          ...mov,
          data: mov.data || now(),
          updated_at: now(),
        }]);
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar movimentação ${mov.id}: ${e}`);
    }
  }

  return result;
}

export function detectConflicts(
  localClientes: Cliente[],
  remoteClientes: Cliente[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  
  for (const local of localClientes) {
    const remote = remoteClientes.find(r => r.id === local.id);
    if (remote) {
      const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      const remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
      
      if (remoteTime > localTime) {
        conflicts.push({
          entityType: 'cliente',
          entityId: local.id,
          localData: local,
          remoteData: remote,
          localUpdatedAt: local.updated_at || local.created_at || '',
          remoteUpdatedAt: remote.updated_at || '',
        });
      }
    }
  }
  
  return conflicts;
}