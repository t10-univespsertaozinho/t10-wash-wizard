import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque, Conflict, SyncStatus } from '@/types';
import { useAuth } from './AuthContext';
import { encryptStorage, decryptStorage } from '@/utils/security';
import { getDatabase, isFirebaseActive, syncLocalToFirebase, detectConflicts } from '@/services/database';
import { isFirebaseConfigured } from '@/lib/firebase';

const genId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

interface AppState {
  clientes: Cliente[];
  veiculos: Veiculo[];
  tiposLavagem: TipoLavagem[];
  lavagens: Lavagem[];
  produtos: Produto[];
  movimentacoes: MovimentacaoEstoque[];
}

interface AppContextType extends AppState {
  syncStatus: SyncStatus;
  lastSync: string | null;
  conflicts: Conflict[];
  hasPendingChanges: boolean;
  syncToFirebase: () => Promise<Conflict[]>;
  resolveConflict: (entityType: string, entityId: string, useLocal: boolean) => void;
  addCliente: (c: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>) => Cliente;
  updateCliente: (id: string, c: Partial<Cliente>) => void;
  deleteCliente: (id: string) => void;
  addVeiculo: (v: Omit<Veiculo, 'id' | 'updated_at'>) => Veiculo;
  deleteVeiculo: (id: string) => void;
  addTipoLavagem: (t: Omit<TipoLavagem, 'id'>) => void;
  deleteTipoLavagem: (id: string) => void;
  addLavagem: (l: Omit<Lavagem, 'id' | 'data' | 'data_conclusao' | 'updated_at'>) => void;
  updateLavagemStatus: (id: string, status: Lavagem['status']) => void;
  addProduto: (p: Omit<Produto, 'id' | 'updated_at'>) => void;
  updateProduto: (id: string, p: Partial<Produto>) => void;
  deleteProduto: (id: string) => void;
  addMovimentacao: (m: Omit<MovimentacaoEstoque, 'id' | 'data' | 'updated_at'>) => void;
  getCliente: (id: string) => Cliente | undefined;
  getVeiculosCliente: (clienteId: string) => Veiculo[];
  getLavagensCliente: (clienteId: string) => Lavagem[];
  getTipoLavagem: (id: string) => TipoLavagem | undefined;
  getProduto: (id: string) => Produto | undefined;
  produtosBaixoEstoque: Produto[];
  seedTestData: () => void;
}

const defaultTipos: TipoLavagem[] = [
  { id: genId(), nome: 'Lavagem Simples', descricao: 'Lavagem externa com água e sabão', preco: 25 },
  { id: genId(), nome: 'Lavagem Completa', descricao: 'Lavagem interna e externa completa', preco: 45 },
  { id: genId(), nome: 'Polimento', descricao: 'Polimento completo da pintura', preco: 80 },
  { id: genId(), nome: 'Lavagem a Seco', descricao: 'Lavagem ecológica sem uso de água', preco: 35 },
];

const initialState: AppState = {
  clientes: [],
  veiculos: [],
  tiposLavagem: defaultTipos,
  lavagens: [],
  produtos: [],
  movimentacoes: [],
};

async function loadStateAsync(): Promise<AppState> {
  try {
    const encrypted = localStorage.getItem('t10_state');
    if (encrypted) {
      const decrypted = await decryptStorage(encrypted);
      if (decrypted) {
        const parsed = JSON.parse(decrypted);
        if (parsed.clientes && parsed.veiculos && parsed.lavagens && 
            parsed.produtos && parsed.movimentacoes) {
          return parsed;
        }
      }
    }
  } catch {
    // Silent fail
  }
  return initialState;
}

async function saveStateAsync(state: AppState): Promise<void> {
  try {
    const data = JSON.stringify(state);
    const encrypted = await encryptStorage(data);
    localStorage.setItem('t10_state', encrypted);
  } catch {
    // Fallback to unencrypted if encryption fails
    localStorage.setItem('t10_state', JSON.stringify(state));
  }
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const hasPendingChanges = useMemo(() => {
    const allItems = [...state.clientes, ...state.veiculos, ...state.lavagens, ...state.produtos];
    return allItems.some(item => item._syncStatus === 'pending');
  }, [state]);

  useEffect(() => {
    async function init() {
      if (!user) {
        const s = await loadStateAsync();
        setState(s);
        setIsReady(true);
        return;
      }

      if (isFirebaseConfigured() && isFirebaseActive()) {
        try {
          const db = getDatabase();
          await db.initialize();
          
          const [clientes, veiculos, lavagens, produtos, movimentacoes, tiposLavagem] = await Promise.all([
            db.getClientes(user.id),
            db.getVeiculos(user.id),
            db.getLavagens(user.id),
            db.getProdutos(user.id),
            db.getMovimentacoes(user.id),
            db.getTiposLavagem(),
          ]);

          const localState = await loadStateAsync();
          
          const allClientes = [...localState.clientes.filter(c => c.user_id === user.id), ...clientes];
          const detectedConflicts = detectConflicts(
            localState.clientes.filter(c => c.user_id === user.id),
            clientes
          );

          if (detectedConflicts.length > 0) {
            setConflicts(detectedConflicts);
            setSyncStatus('conflict');
          }

          setState({
            clientes: allClientes,
            veiculos: [...localState.veiculos.filter(v => v.user_id === user.id), ...veiculos],
            tiposLavagem: tiposLavagem.length > 0 ? tiposLavagem : localState.tiposLavagem,
            lavagens: [...localState.lavagens.filter(l => l.user_id === user.id), ...lavagens],
            produtos: [...localState.produtos.filter(p => p.user_id === user.id), ...produtos],
            movimentacoes: [...localState.movimentacoes.filter(m => m.user_id === user.id), ...movimentacoes],
          });

          setSyncStatus(detectedConflicts.length > 0 ? 'conflict' : 'synced');
        } catch (e) {
          console.error('Erro ao carregar do Firebase:', e);
          const s = await loadStateAsync();
          setState(s);
          setSyncStatus('synced');
        }
      } else {
        const s = await loadStateAsync();
        setState(s);
      }

      setIsReady(true);
    }

    init();
  }, [user]);

  useEffect(() => {
    if (isReady && user) {
      saveStateAsync(state);
    }
  }, [state, isReady, user]);

  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (!user || !hasPendingChanges || !isFirebaseActive()) return;
      
      e.preventDefault();
      
      const result = await syncLocalToFirebase(
        state.clientes.filter(c => c.user_id === user.id),
        state.veiculos.filter(v => v.user_id === user.id),
        state.lavagens.filter(l => l.user_id === user.id),
        state.produtos.filter(p => p.user_id === user.id),
        state.movimentacoes.filter(m => m.user_id === user.id),
        user.id
      );

      if (result.conflicts.length > 0) {
        localStorage.setItem('t10_pending_conflicts', JSON.stringify(result.conflicts));
        setConflicts(prev => [...prev, ...result.conflicts]);
        setSyncStatus('conflict');
      } else {
        const syncedItems = [...state.clientes, ...state.veiculos, ...state.lavagens, ...state.produtos]
          .map(item => ({ ...item, _syncStatus: 'synced' as const }));
        
        setState(prev => ({
          ...prev,
          clientes: syncedItems.filter(i => 'nome' in i) as Cliente[],
          veiculos: syncedItems.filter(i => 'modelo' in i) as Veiculo[],
          lavagens: syncedItems.filter(i => 'status' in i) as Lavagem[],
          produtos: syncedItems.filter(i => 'quantidade' in i) as Produto[],
        }));
        
        setSyncStatus('synced');
        setLastSync(new Date().toISOString());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state, user, hasPendingChanges]);

  useEffect(() => {
    const savedConflicts = localStorage.getItem('t10_pending_conflicts');
    if (savedConflicts) {
      try {
        const parsed = JSON.parse(savedConflicts);
        if (parsed.length > 0) {
          setConflicts(parsed);
          setSyncStatus('conflict');
          localStorage.removeItem('t10_pending_conflicts');
        }
      } catch {
        // Silently ignore parse errors
      }
    }
  }, []);

  const syncToFirebase = useCallback(async (): Promise<Conflict[]> => {
    if (!user) return [];

    const result = await syncLocalToFirebase(
      state.clientes.filter(c => c.user_id === user.id),
      state.veiculos.filter(v => v.user_id === user.id),
      state.lavagens.filter(l => l.user_id === user.id),
      state.produtos.filter(p => p.user_id === user.id),
      state.movimentacoes.filter(m => m.user_id === user.id),
      user.id
    );

    if (result.conflicts.length > 0) {
      setConflicts(prev => [...prev, ...result.conflicts]);
      setSyncStatus('conflict');
    } else {
      const syncedItems = [...state.clientes, ...state.veiculos, ...state.lavagens, ...state.produtos]
        .map(item => ({ ...item, _syncStatus: 'synced' as const }));
      
      setState(prev => ({
        ...prev,
        clientes: syncedItems.filter(i => 'nome' in i) as Cliente[],
        veiculos: syncedItems.filter(i => 'modelo' in i) as Veiculo[],
        lavagens: syncedItems.filter(i => 'status' in i) as Lavagem[],
        produtos: syncedItems.filter(i => 'quantidade' in i) as Produto[],
      }));
      
      setSyncStatus('synced');
      setLastSync(new Date().toISOString());
    }

    return result.conflicts;
  }, [state, user]);

  const resolveConflict = useCallback((entityType: string, entityId: string, useLocal: boolean) => {
    const resolved = conflicts.filter(c => !(c.entityType === entityType && c.entityId === entityId));
    setConflicts(resolved);
    
    if (resolved.length === 0) {
      setSyncStatus('synced');
    }
  }, [conflicts]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(prev => fn(prev)), []);

  const addCliente = (c: Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'user_id' | '_syncStatus'>) => {
    if (!user) throw new Error('Auth required');
    const timestamp = now();
    const novo: Cliente = { ...c, id: genId(), user_id: user.id, created_at: timestamp, updated_at: timestamp, _syncStatus: 'pending' };
    update(s => ({ ...s, clientes: [...s.clientes, novo] }));
    setSyncStatus('pending');
    return novo;
  };
  const updateCliente = (id: string, c: Partial<Cliente>) => {
    const timestamp = now();
    update(s => ({
      ...s,
      clientes: s.clientes.map(x => x.id === id ? { ...x, ...c, updated_at: timestamp, _syncStatus: 'pending' } : x)
    }));
    setSyncStatus('pending');
  };
  const deleteCliente = (id: string) => update(s => ({
    ...s,
    clientes: s.clientes.filter(x => x.id !== id),
    veiculos: s.veiculos.filter(x => x.cliente_id !== id),
    lavagens: s.lavagens.filter(x => x.cliente_id !== id),
  }));
  const addVeiculo = (v: Omit<Veiculo, 'id' | 'updated_at' | 'user_id' | '_syncStatus'>) => {
    if (!user) throw new Error('Auth required');
    const timestamp = now();
    const novo: Veiculo = { ...v, id: genId(), user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' };
    update(s => ({ ...s, veiculos: [...s.veiculos, novo] }));
    setSyncStatus('pending');
    return novo;
  };
  const deleteVeiculo = (id: string) => update(s => ({
    ...s, veiculos: s.veiculos.filter(x => x.id !== id)
  }));
  const addTipoLavagem = (t: Omit<TipoLavagem, 'id'>) => update(s => ({
    ...s, tiposLavagem: [...s.tiposLavagem, { ...t, id: genId() }]
  }));
  const deleteTipoLavagem = (id: string) => update(s => ({
    ...s, tiposLavagem: s.tiposLavagem.filter(x => x.id !== id)
  }));
  const addLavagem = (l: Omit<Lavagem, 'id' | 'data' | 'data_conclusao' | 'updated_at' | 'user_id' | '_syncStatus'>) => {
    if (!user) throw new Error('Auth required');
    const timestamp = now();
    update(s => ({ ...s, lavagens: [...s.lavagens, { ...l, id: genId(), user_id: user.id, data: timestamp, data_conclusao: null, updated_at: timestamp, _syncStatus: 'pending' }] }));
    setSyncStatus('pending');
  };
  const updateLavagemStatus = (id: string, status: Lavagem['status']) => {
    const timestamp = now();
    update(s => ({
      ...s,
      lavagens: s.lavagens.map(x => x.id === id ? {
        ...x, status, data_conclusao: status === 'concluida' ? timestamp : x.data_conclusao, updated_at: timestamp, _syncStatus: 'pending'
      } : x)
    }));
    setSyncStatus('pending');
  };
  const addProduto = (p: Omit<Produto, 'id' | 'updated_at' | 'user_id' | '_syncStatus'>) => {
    if (!user) throw new Error('Auth required');
    const timestamp = now();
    update(s => ({ ...s, produtos: [...s.produtos, { ...p, id: genId(), user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' }] }));
    setSyncStatus('pending');
  };
  const updateProduto = (id: string, p: Partial<Produto>) => {
    const timestamp = now();
    update(s => ({
      ...s,
      produtos: s.produtos.map(x => x.id === id ? { ...x, ...p, updated_at: timestamp, _syncStatus: 'pending' } : x)
    }));
    setSyncStatus('pending');
  };
  const deleteProduto = (id: string) => update(s => ({
    ...s, produtos: s.produtos.filter(x => x.id !== id)
  }));
  const addMovimentacao = (m: Omit<MovimentacaoEstoque, 'id' | 'data' | 'updated_at'>) => {
    const timestamp = now();
    update(s => {
      const produto = s.produtos.find(p => p.id === m.produto_id);
      if (!produto) return s;
      const novaQtd = m.tipo === 'entrada'
        ? produto.quantidade + m.quantidade
        : Math.max(0, produto.quantidade - m.quantidade);
      return {
        ...s,
        produtos: s.produtos.map(p => p.id === m.produto_id ? { ...p, quantidade: novaQtd, updated_at: timestamp, _syncStatus: 'pending' } : p),
        movimentacoes: [...s.movimentacoes, { ...m, id: genId(), data: timestamp, updated_at: timestamp }],
      };
    });
    setSyncStatus('pending');
  };

  const getCliente = (id: string) => state.clientes.find(c => c.id === id);
  const getVeiculosCliente = (cid: string) => state.veiculos.filter(v => v.cliente_id === cid);
  const getLavagensCliente = (cid: string) => state.lavagens.filter(l => l.cliente_id === cid);
  const getTipoLavagem = (id: string) => state.tiposLavagem.find(t => t.id === id);
  const getProduto = (id: string) => state.produtos.find(p => p.id === id);
  const produtosBaixoEstoque = state.produtos.filter(p => p.quantidade <= p.estoque_minimo);
  
  const seedTestData = () => {
    if (!user) return;
    const timestamp = now();
    const c1Id = genId();
    const c2Id = genId();
    const c3Id = genId();
    const c4Id = genId();
    
    const novosClientes: Cliente[] = [
      { id: c1Id, nome: 'João Silva', telefone: '(11) 98888-7777', user_id: user.id, created_at: timestamp, updated_at: timestamp, _syncStatus: 'pending' },
      { id: c2Id, nome: 'Maria Oliveira', telefone: '(11) 97777-6666', user_id: user.id, created_at: timestamp, updated_at: timestamp, _syncStatus: 'pending' },
      { id: c3Id, nome: 'Carlos Santos', telefone: '(11) 96666-5555', user_id: user.id, created_at: timestamp, updated_at: timestamp, _syncStatus: 'pending' },
      { id: c4Id, nome: 'Ana Paula', telefone: '(11) 95555-4444', user_id: user.id, created_at: timestamp, updated_at: timestamp, _syncStatus: 'pending' },
    ];

    const novosVeiculos: Veiculo[] = [
      { id: genId(), cliente_id: c1Id, modelo: 'Toyota Corolla', placa: 'ABC-1234', cor: 'Prata', user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' },
      { id: genId(), cliente_id: c2Id, modelo: 'Honda Civic', placa: 'XYZ-9876', cor: 'Preto', user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' },
      { id: genId(), cliente_id: c3Id, modelo: 'Volkswagen Gol', placa: 'DEF-5678', cor: 'Branco', user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' },
      { id: genId(), cliente_id: c4Id, modelo: 'Ford Ka', placa: 'GHI-9012', cor: 'Vermelho', user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' },
    ];

    const p1Id = genId();
    const p2Id = genId();
    const p3Id = genId();

    const novosProdutos: Produto[] = [
      { id: p1Id, nome: 'Shampoo Automotivo', categoria: 'Limpeza', quantidade: 25, unidade: 'L', estoque_minimo: 10, preco_unitario: 12, user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' },
      { id: p2Id, nome: 'Cera de Polimento', categoria: 'Polimento', quantidade: 8, unidade: 'un', estoque_minimo: 5, preco_unitario: 25, user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' },
      { id: p3Id, nome: 'Limpa Vidros', categoria: 'Limpeza', quantidade: 15, unidade: 'L', estoque_minimo: 8, preco_unitario: 8, user_id: user.id, updated_at: timestamp, _syncStatus: 'pending' },
    ];

    const tipos = state.tiposLavagem;
    const dayMs = 86400000;
    const hourMs = 3600000;

    const novasLavagens: Lavagem[] = [];
    const novasMovimentacoes: MovimentacaoEstoque[] = [];

    for (let m = 5; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      const monthKey = d.toISOString().slice(0, 7);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      
      const lavagensNoMes = Math.floor(Math.random() * 20) + 15;
      for (let i = 0; i < lavagensNoMes; i++) {
        const day = Math.floor(Math.random() * daysInMonth) + 1;
        const dataLavagem = new Date(d.getFullYear(), d.getMonth(), day, 10, Math.floor(Math.random() * 60));
        const status = Math.random() > 0.15 ? 'concluida' : (Math.random() > 0.5 ? 'pendente' : 'em_andamento');
        
        const clienteIdx = Math.floor(Math.random() * novosVeiculos.length);
        const tipoIdx = Math.floor(Math.random() * tipos.length);
        
        novasLavagens.push({
          id: genId(),
          cliente_id: novosClientes[clienteIdx].id,
          veiculo_id: novosVeiculos[clienteIdx].id,
          tipo_lavagem_id: tipos[tipoIdx].id,
          valor: tipos[tipoIdx].preco,
          status,
          pagamento: 'Dinheiro',
          observacao: '',
          user_id: user.id,
          data: dataLavagem.toISOString(),
          data_conclusao: status === 'concluida' ? new Date(dataLavagem.getTime() + hourMs).toISOString() : null,
        });
      }

      const entradaQtd = Math.floor(Math.random() * 30) + 20;
      const saidaQtd = Math.floor(Math.random() * 15) + 10;
      
      novasMovimentacoes.push({
        id: genId(),
        produto_id: p1Id,
        tipo: 'entrada',
        quantidade: entradaQtd,
        observacao: 'Reposição mensal',
        user_id: user.id,
        data: new Date(d.getFullYear(), d.getMonth(), 15).toISOString(),
      });
      
      novasMovimentacoes.push({
        id: genId(),
        produto_id: p1Id,
        tipo: 'saida',
        quantidade: saidaQtd,
        observacao: 'Consumo lavagens',
        user_id: user.id,
        data: new Date(d.getFullYear(), d.getMonth(), 28).toISOString(),
      });

      if (m % 2 === 0) {
        novasMovimentacoes.push({
          id: genId(),
          produto_id: p2Id,
          tipo: 'entrada',
          quantidade: Math.floor(Math.random() * 10) + 5,
          observacao: 'Reposição',
          user_id: user.id,
          data: new Date(d.getFullYear(), d.getMonth(), 10).toISOString(),
        });
      }
    }

    novasLavagens.push(
      { 
        id: genId(), 
        cliente_id: c1Id, 
        veiculo_id: novosVeiculos[0].id, 
        tipo_lavagem_id: tipos[0].id, 
        valor: tipos[0].preco, 
        status: 'concluida', 
        pagamento: 'Dinheiro',
        observacao: 'Lavagem padrão',
        user_id: user.id,
        data: new Date(Date.now() - dayMs * 2).toISOString(), 
        data_conclusao: new Date(Date.now() - dayMs * 2 + hourMs).toISOString() 
      },
      { 
        id: genId(), 
        cliente_id: c2Id, 
        veiculo_id: novosVeiculos[1].id, 
        tipo_lavagem_id: tipos[1].id, 
        valor: tipos[1].preco, 
        status: 'pendente', 
        pagamento: 'Pendente',
        observacao: '',
        user_id: user.id,
        data: now(), 
        data_conclusao: null 
      }
    );

    setState({
      clientes: [...state.clientes, ...novosClientes],
      veiculos: [...state.veiculos, ...novosVeiculos],
      tiposLavagem: state.tiposLavagem,
      produtos: [...state.produtos, ...novosProdutos],
      lavagens: [...state.lavagens, ...novasLavagens],
      movimentacoes: [...state.movimentacoes, ...novasMovimentacoes],
    });
  };

  const filteredState = useMemo(() => {
    if (!user) return state;
    if (user.role === 'admin') return state;
    
    return {
      ...state,
      clientes: state.clientes.filter(c => c.user_id === user.id),
      veiculos: state.veiculos.filter(v => v.user_id === user.id),
      lavagens: state.lavagens.filter(l => l.user_id === user.id),
      produtos: state.produtos.filter(p => p.user_id === user.id),
      movimentacoes: state.movimentacoes.filter(m => m.user_id === user.id),
    };
  }, [state, user]);

  return (
    <AppContext.Provider value={{
      ...filteredState,
      syncStatus,
      lastSync,
      conflicts,
      hasPendingChanges,
      syncToFirebase,
      resolveConflict,
      addCliente, updateCliente, deleteCliente,
      addVeiculo, deleteVeiculo, addTipoLavagem, deleteTipoLavagem,
      addLavagem, updateLavagemStatus, addProduto, updateProduto,
      deleteProduto, addMovimentacao, getCliente, getVeiculosCliente,
      getLavagensCliente, getTipoLavagem, getProduto, produtosBaixoEstoque,
      seedTestData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
