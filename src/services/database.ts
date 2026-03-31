import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque } from '@/types';
import { 
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp 
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';

const STORAGE_KEY = 't10_state';

export type DatabaseType = 'localstorage' | 'firebase';

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
  getVeiculo(id: string): Promise<Veiculo | null>;
  createVeiculo(data: Omit<Veiculo, 'id'>): Promise<Veiculo>;
  updateVeiculo(id: string, data: Partial<Veiculo>): Promise<Veiculo>;
  deleteVeiculo(id: string): Promise<void>;

  getLavagens(userId: string): Promise<Lavagem[]>;
  getLavagensByCliente(clienteId: string): Promise<Lavagem[]>;
  getLavagensByVeiculo(veiculoId: string): Promise<Lavagem[]>;
  getLavagem(id: string): Promise<Lavagem | null>;
  createLavagem(data: Omit<Lavagem, 'id' | 'data' | 'data_conclusao'>): Promise<Lavagem>;
  updateLavagem(id: string, data: Partial<Lavagem>): Promise<Lavagem>;
  deleteLavagem(id: string): Promise<void>;

  getTiposLavagem(): Promise<TipoLavagem[]>;
  getTipoLavagem(id: string): Promise<TipoLavagem | null>;
  createTipoLavagem(data: Omit<TipoLavagem, 'id'>): Promise<TipoLavagem>;
  updateTipoLavagem(id: string, data: Partial<TipoLavagem>): Promise<TipoLavagem>;
  deleteTipoLavagem(id: string): Promise<void>;

  getProdutos(userId: string): Promise<Produto[]>;
  getProduto(id: string): Promise<Produto | null>;
  createProduto(data: Omit<Produto, 'id'>): Promise<Produto>;
  updateProduto(id: string, data: Partial<Produto>): Promise<Produto>;
  deleteProduto(id: string): Promise<void>;

  getMovimentacoes(userId: string): Promise<MovimentacaoEstoque[]>;
  getMovimentacoesByProduto(produtoId: string): Promise<MovimentacaoEstoque[]>;
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

  async getVeiculo(id: string) {
    const state = loadState();
    return state.veiculos.find(v => v.id === id) || null;
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

  async getLavagensByVeiculo(veiculoId: string) {
    const state = loadState();
    return state.lavagens.filter(l => l.veiculo_id === veiculoId);
  },

  async getLavagem(id: string) {
    const state = loadState();
    return state.lavagens.find(l => l.id === id) || null;
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

  async getTipoLavagem(id: string) {
    const state = loadState();
    return state.tiposLavagem.find(t => t.id === id) || null;
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
    if (idx === -1) throw new Error('Tipo de lavagem não encontrado');
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

  async getProduto(id: string) {
    const state = loadState();
    return state.produtos.find(p => p.id === id) || null;
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
    state.movimentacoes = state.movimentacoes.filter(m => m.produto_id !== id);
    saveState(state);
  },

  async getMovimentacoes(userId: string) {
    const state = loadState();
    return state.movimentacoes.filter(m => m.user_id === userId);
  },

  async getMovimentacoesByProduto(produtoId: string) {
    const state = loadState();
    return state.movimentacoes.filter(m => m.produto_id === produtoId);
  },

  async createMovimentacao(data) {
    const state = loadState();
    const produto = state.produtos.find(p => p.id === data.produto_id);
    if (!produto) throw new Error('Produto não encontrado');
    
    const novaQtd = data.tipo === 'entrada'
      ? produto.quantidade + data.quantidade
      : Math.max(0, produto.quantidade - data.quantidade);
    
    state.produtos = state.produtos.map(p => 
      p.id === data.produto_id ? { ...p, quantidade: novaQtd } : p
    );
    
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

function documentToCliente(docSnap: any): Cliente {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    nome: data.nome,
    telefone: data.telefone,
    user_id: data.user_id,
    created_at: timestampToISOString(data.created_at),
  };
}

function documentToVeiculo(docSnap: any): Veiculo {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    cliente_id: data.cliente_id,
    modelo: data.modelo,
    placa: data.placa,
    cor: data.cor,
    user_id: data.user_id,
  };
}

function documentToLavagem(docSnap: any): Lavagem {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    cliente_id: data.cliente_id,
    veiculo_id: data.veiculo_id,
    tipo_lavagem_id: data.tipo_lavagem_id,
    status: data.status,
    pagamento: data.pagamento,
    valor: data.valor,
    observacao: data.observacao,
    user_id: data.user_id,
    data: timestampToISOString(data.data),
    data_conclusao: timestampToISOString(data.data_conclusao),
  };
}

function documentToTipoLavagem(docSnap: any): TipoLavagem {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    nome: data.nome,
    descricao: data.descricao,
    preco: data.preco,
  };
}

function documentToProduto(docSnap: any): Produto {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    nome: data.nome,
    categoria: data.categoria,
    quantidade: data.quantidade,
    estoque_minimo: data.estoque_minimo,
    unidade: data.unidade,
    preco_unitario: data.preco_unitario,
    user_id: data.user_id,
  };
}

function documentToMovimentacao(docSnap: any): MovimentacaoEstoque {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    produto_id: data.produto_id,
    tipo: data.tipo,
    quantidade: data.quantidade,
    observacao: data.observacao,
    user_id: data.user_id,
    data: timestampToISOString(data.data),
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
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...data,
      created_at: Timestamp.now(),
    });
    return { id: docRef.id, ...data, created_at: now() };
  },

  async updateCliente(id, data) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'clientes', id);
    await updateDoc(docRef, data);
    return (await this.getCliente(id))!;
  },

  async deleteCliente(id) {
    const db = getFirebaseDb();
    const clienteDoc = doc(db, 'clientes', id);
    
    const veiculosQ = query(collection(db, 'veiculos'), where('cliente_id', '==', id));
    const veiculosSnap = await getDocs(veiculosQ);
    for (const v of veiculosSnap.docs) {
      await deleteDoc(doc(db, 'veiculos', v.id));
    }
    
    const lavagensQ = query(collection(db, 'lavagens'), where('cliente_id', '==', id));
    const lavagensSnap = await getDocs(lavagensQ);
    for (const l of lavagensSnap.docs) {
      await deleteDoc(doc(db, 'lavagens', l.id));
    }
    
    await deleteDoc(clienteDoc);
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

  async getVeiculo(id: string) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'veiculos', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return documentToVeiculo(docSnap);
  },

  async createVeiculo(data) {
    const db = getFirebaseDb();
    const docRef = await addDoc(collection(db, 'veiculos'), data);
    return { id: docRef.id, ...data };
  },

  async updateVeiculo(id, data) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'veiculos', id);
    await updateDoc(docRef, data);
    return (await this.getVeiculo(id))!;
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

  async getLavagensByVeiculo(veiculoId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'lavagens'), where('veiculo_id', '==', veiculoId), orderBy('data', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToLavagem);
  },

  async getLavagem(id: string) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'lavagens', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return documentToLavagem(docSnap);
  },

  async createLavagem(data) {
    const db = getFirebaseDb();
    const nowTimestamp = Timestamp.now();
    const docRef = await addDoc(collection(db, 'lavagens'), {
      ...data,
      data: nowTimestamp,
      data_conclusao: null,
    });
    return { id: docRef.id, ...data, data: now().toString(), data_conclusao: null };
  },

  async updateLavagem(id, data) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'lavagens', id);
    await updateDoc(docRef, data);
    return (await this.getLavagem(id))!;
  },

  async deleteLavagem(id) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, 'lavagens', id));
  },

  async getTiposLavagem() {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, 'tipos_lavagem'));
    if (snapshot.empty) {
      for (const tipo of defaultTipos) {
        await addDoc(collection(db, 'tipos_lavagem'), tipo);
      }
      return defaultTipos;
    }
    return snapshot.docs.map(documentToTipoLavagem);
  },

  async getTipoLavagem(id: string) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'tipos_lavagem', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return documentToTipoLavagem(docSnap);
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
    return (await this.getTipoLavagem(id))!;
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

  async getProduto(id: string) {
    const db = getFirebaseDb();
    const docRef = doc(db, 'produtos', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return documentToProduto(docSnap);
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
    return (await this.getProduto(id))!;
  },

  async deleteProduto(id) {
    const db = getFirebaseDb();
    const movQ = query(collection(db, 'movimentacoes'), where('produto_id', '==', id));
    const movSnap = await getDocs(movQ);
    for (const m of movSnap.docs) {
      await deleteDoc(doc(db, 'movimentacoes', m.id));
    }
    await deleteDoc(doc(db, 'produtos', id));
  },

  async getMovimentacoes(userId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'movimentacoes'), where('user_id', '==', userId), orderBy('data', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToMovimentacao);
  },

  async getMovimentacoesByProduto(produtoId: string) {
    const db = getFirebaseDb();
    const q = query(collection(db, 'movimentacoes'), where('produto_id', '==', produtoId), orderBy('data', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(documentToMovimentacao);
  },

  async createMovimentacao(data) {
    const db = getFirebaseDb();
    
    const produtoDoc = await getDoc(doc(db, 'produtos', data.produto_id));
    if (!produtoDoc.exists()) throw new Error('Produto não encontrado');
    
    const produto = documentToProduto(produtoDoc);
    const novaQtd = data.tipo === 'entrada'
      ? produto.quantidade + data.quantidade
      : Math.max(0, produto.quantidade - data.quantidade);
    
    await updateDoc(doc(db, 'produtos', data.produto_id), { quantidade: novaQtd });
    
    const docRef = await addDoc(collection(db, 'movimentacoes'), {
      ...data,
      data: Timestamp.now(),
    });
    return { id: docRef.id, ...data, data: now() };
  },
};

export function getDatabase(): Database {
  const type = (import.meta.env.VITE_DB_TYPE as DatabaseType) || 'localstorage';
  
  switch (type) {
    case 'firebase':
      return firebaseDB;
    default:
      return localStorageDB;
  }
}
