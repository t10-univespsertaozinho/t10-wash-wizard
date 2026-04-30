import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque, Conflict } from '@/types';
import { 
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, DocumentSnapshot 
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';

const STORAGE_KEY = 't10_state';

export type DatabaseType = 'localstorage' | 'firebase';

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

function timestampToISOString(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  return ts.toDate().toISOString();
}

function documentToCliente(docSnap: DocumentSnapshot): Cliente {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    nome: data?.nome,
    telefone: data?.telefone,
    user_id: data?.user_id,
    created_at: timestampToISOString(data?.created_at),
  };
}

function documentToVeiculo(docSnap: DocumentSnapshot): Veiculo {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    cliente_id: data?.cliente_id,
    modelo: data?.modelo,
    placa: data?.placa,
    cor: data?.cor,
    user_id: data?.user_id,
  };
}

function documentToLavagem(docSnap: DocumentSnapshot): Lavagem {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    cliente_id: data?.cliente_id,
    veiculo_id: data?.veiculo_id,
    tipo_lavagem_id: data?.tipo_lavagem_id,
    status: data?.status,
    pagamento: data?.pagamento,
    valor: data?.valor,
    observacao: data?.observacao,
    user_id: data?.user_id,
    data: timestampToISOString(data?.data),
    data_conclusao: timestampToISOString(data?.data_conclusao),
  };
}

function documentToTipoLavagem(docSnap: DocumentSnapshot): TipoLavagem {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    nome: data?.nome,
    descricao: data?.descricao,
    preco: data?.preco,
  };
}

function documentToProduto(docSnap: DocumentSnapshot): Produto {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    nome: data?.nome,
    categoria: data?.categoria,
    quantidade: data?.quantidade,
    estoque_minimo: data?.estoque_minimo,
    unidade: data?.unidade,
    preco_unitario: data?.preco_unitario,
    user_id: data?.user_id,
  };
}

function documentToMovimentacao(docSnap: DocumentSnapshot): MovimentacaoEstoque {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    produto_id: data?.produto_id,
    tipo: data?.tipo,
    quantidade: data?.quantidade,
    observacao: data?.observacao,
    user_id: data?.user_id,
    data: timestampToISOString(data?.data),
  };
}

export const firebaseDB: Database = {
  async initialize() {
    if (!isFirebaseConfigured()) {
      console.warn('Firebase não configurado. Use localStorage.');
    }
  },

  async getClientes(userId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'clientes'), where('user_id', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToCliente);
  },

  async getCliente(id: string) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'clientes', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return documentToCliente(docSnap);
  },

  async createCliente(data) {
    const db = getFirebaseDb();
    const timestamp = Timestamp.now();
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...data,
      created_at: timestamp,
    });
    return { id: docRef.id, ...data, created_at: timestampToISOString(timestamp) };
  },

  async updateCliente(id, data) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'clientes', id);
    await updateDoc(docRef, data);
    return (await this.getCliente(id))!;
  },

  async deleteCliente(id) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, 'clientes', id));
  },

  async getVeiculos(userId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'veiculos'), where('user_id', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToVeiculo);
  },

  async getVeiculosByCliente(clienteId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'veiculos'), where('cliente_id', '==', clienteId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToVeiculo);
  },

  async createVeiculo(data) {
    const db = getFirebaseDb();
    const docRef = await addDoc(collection(db, 'veiculos'), data);
    return { id: docRef.id, ...data };
  },

  async deleteVeiculo(id) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, 'veiculos', id));
  },

  async getLavagens(userId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'lavagens'), where('user_id', '==', userId), orderBy('data', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToLavagem);
  },

  async getLavagensByCliente(clienteId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'lavagens'), where('cliente_id', '==', clienteId), orderBy('data', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToLavagem);
  },

  async createLavagem(data) {
    const db = getFirebaseDb();
    const timestamp = Timestamp.now();
    const docRef = await addDoc(collection(db, 'lavagens'), {
      ...data,
      data: timestamp,
      data_conclusao: null,
    });
    return { id: docRef.id, ...data, data: timestampToISOString(timestamp), data_conclusao: null };
  },

  async updateLavagem(id, data) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'lavagens', id);
    await updateDoc(docRef, data);
    const docSnap = await getDoc(docRef);
    return documentToLavagem(docSnap);
  },

  async deleteLavagem(id) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, 'lavagens', id));
  },

  async getTiposLavagem() {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, 'tipos_lavagem'));
    if (snapshot.empty) {
      const novosTipos: TipoLavagem[] = [];
      for (const tipo of defaultTipos) {
        const { id, ...data } = tipo;
        const docRef = await addDoc(collection(db, 'tipos_lavagem'), data);
        novosTipos.push({ id: docRef.id, ...data });
      }
      return novosTipos;
    }
    return snapshot.docs.map(documentToTipoLavagem);
  },

  async createTipoLavagem(data) {
    const db = getFirebaseDb();
    const docRef = await addDoc(collection(db, 'tipos_lavagem'), data);
    return { id: docRef.id, ...data };
  },

  async updateTipoLavagem(id, data) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'tipos_lavagem', id);
    await updateDoc(docRef, data);
    const docSnap = await getDoc(docRef);
    return documentToTipoLavagem(docSnap);
  },

  async deleteTipoLavagem(id) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, 'tipos_lavagem', id));
  },

  async getProdutos(userId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'produtos'), where('user_id', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToProduto);
  },

  async createProduto(data) {
    const db = getFirebaseDb();
    const docRef = await addDoc(collection(db, 'produtos'), data);
    return { id: docRef.id, ...data };
  },

  async updateProduto(id, data) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'produtos', id);
    await updateDoc(docRef, data);
    const docSnap = await getDoc(docRef);
    return documentToProduto(docSnap);
  },

  async deleteProduto(id) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, 'produtos', id));
  },

  async getMovimentacoes(userId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'movimentacoes'), where('user_id', '==', userId), orderBy('data', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToMovimentacao);
  },

  async createMovimentacao(data) {
    const db = getFirebaseDb();
    const timestamp = Timestamp.now();
    const docRef = await addDoc(collection(db, 'movimentacoes'), {
      ...data,
      data: timestamp,
    });
    return { id: docRef.id, ...data, data: timestampToISOString(timestamp) };
  },
};

export function getDatabase(): Database {
  const type = getDatabaseType();
  switch (type) {
    case 'firebase':
      return firebaseDB;
    default:
      return localStorageDB;
  }
}

export function getDatabaseType(): DatabaseType {
  const savedType = localStorage.getItem('t10_db_type') as DatabaseType | null;
  if (savedType) return savedType;
  const envType = import.meta.env.VITE_DB_TYPE as DatabaseType;
  return envType || 'localstorage';
}

export function isFirebaseActive(): boolean {
  return getDatabaseType() === 'firebase';
}

interface SyncResult {
  conflicts: Conflict[];
  synced: number;
  errors: string[];
}

export async function syncLocalToFirebase(
  clientes: Cliente[],
  veiculos: Veiculo[],
  lavagens: Lavagem[],
  produtos: Produto[],
  movimentacoes: MovimentacaoEstoque[],
  userId: string
): Promise<SyncResult> {
  const result: SyncResult = { conflicts: [], synced: 0, errors: [] };
  
  if (!isFirebaseConfigured()) {
    result.errors.push('Firebase não configurado');
    return result;
  }

  const db = getFirebaseDb();

  for (const cliente of clientes) {
    try {
      const existing = await getDoc(doc(db, 'clientes', cliente.id));
      
      if (existing.exists()) {
        const remoteData = existing.data();
        const localUpdated = new Date(cliente.updated_at || cliente.created_at).getTime();
        const remoteUpdated = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : 0;
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'cliente',
            entityId: cliente.id,
            localData: cliente,
            remoteData: { id: cliente.id, ...remoteData },
            localUpdatedAt: cliente.updated_at || cliente.created_at,
            remoteUpdatedAt: remoteData.updated_at || '',
          });
        } else {
          await updateDoc(doc(db, 'clientes', cliente.id), {
            ...cliente,
            updated_at: Timestamp.now(),
          });
          result.synced++;
        }
      } else {
        await addDoc(collection(db, 'clientes'), {
          ...cliente,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar cliente ${cliente.id}: ${e}`);
    }
  }

  for (const veiculo of veiculos) {
    try {
      const existing = await getDoc(doc(db, 'veiculos', veiculo.id));
      
      if (existing.exists()) {
        const remoteData = existing.data();
        const localUpdated = new Date(veiculo.updated_at || 0).getTime();
        const remoteUpdated = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : 0;
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'veiculo',
            entityId: veiculo.id,
            localData: veiculo,
            remoteData: { id: veiculo.id, ...remoteData },
            localUpdatedAt: veiculo.updated_at || '',
            remoteUpdatedAt: remoteData.updated_at || '',
          });
        } else {
          await updateDoc(doc(db, 'veiculos', veiculo.id), {
            ...veiculo,
            updated_at: Timestamp.now(),
          });
          result.synced++;
        }
      } else {
        await addDoc(collection(db, 'veiculos'), {
          ...veiculo,
          updated_at: Timestamp.now(),
        });
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar veículo ${veiculo.id}: ${e}`);
    }
  }

  for (const lavagem of lavagens) {
    try {
      const existing = await getDoc(doc(db, 'lavagens', lavagem.id));
      
      if (existing.exists()) {
        const remoteData = existing.data();
        const localUpdated = new Date(lavagem.updated_at || lavagem.data).getTime();
        const remoteUpdated = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : new Date(remoteData.data?.toDate?.() || 0).getTime();
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'lavagem',
            entityId: lavagem.id,
            localData: lavagem,
            remoteData: { id: lavagem.id, ...remoteData },
            localUpdatedAt: lavagem.updated_at || lavagem.data,
            remoteUpdatedAt: remoteData.updated_at || '',
          });
        } else {
          await updateDoc(doc(db, 'lavagens', lavagem.id), {
            ...lavagem,
            updated_at: Timestamp.now(),
          });
          result.synced++;
        }
      } else {
        await addDoc(collection(db, 'lavagens'), {
          ...lavagem,
          data: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar lavagem ${lavagem.id}: ${e}`);
    }
  }

  for (const produto of produtos) {
    try {
      const existing = await getDoc(doc(db, 'produtos', produto.id));
      
      if (existing.exists()) {
        const remoteData = existing.data();
        const localUpdated = new Date(produto.updated_at || 0).getTime();
        const remoteUpdated = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : 0;
        
        if (remoteUpdated > localUpdated) {
          result.conflicts.push({
            entityType: 'produto',
            entityId: produto.id,
            localData: produto,
            remoteData: { id: produto.id, ...remoteData },
            localUpdatedAt: produto.updated_at || '',
            remoteUpdatedAt: remoteData.updated_at || '',
          });
        } else {
          await updateDoc(doc(db, 'produtos', produto.id), {
            ...produto,
            updated_at: Timestamp.now(),
          });
          result.synced++;
        }
      } else {
        await addDoc(collection(db, 'produtos'), {
          ...produto,
          updated_at: Timestamp.now(),
        });
        result.synced++;
      }
    } catch (e) {
      result.errors.push(`Erro ao sincronizar produto ${produto.id}: ${e}`);
    }
  }

  for (const mov of movimentacoes) {
    try {
      const existing = await getDoc(doc(db, 'movimentacoes', mov.id));
      
      if (!existing.exists()) {
        await addDoc(collection(db, 'movimentacoes'), {
          ...mov,
          data: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
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
          localUpdatedAt: local.updated_at || local.created_at,
          remoteUpdatedAt: remote.updated_at || '',
        });
      }
    }
  }
  
  return conflicts;
}