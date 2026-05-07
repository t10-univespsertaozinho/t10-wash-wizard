import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque } from '@/types';
import { useAuth } from './AuthContext';
import { getDatabase } from '@/services/database';

interface AppState {
  clientes: Cliente[];
  veiculos: Veiculo[];
  tiposLavagem: TipoLavagem[];
  lavagens: Lavagem[];
  produtos: Produto[];
  movimentacoes: MovimentacaoEstoque[];
}

interface AppContextType extends AppState {
  loading: boolean;
  produtosBaixoEstoque: Produto[];
  getCliente: (id: string) => Cliente | undefined;
  getVeiculosCliente: (clienteId: string) => Veiculo[];
  getLavagensCliente: (clienteId: string) => Lavagem[];
  getTipoLavagem: (id: string) => TipoLavagem | undefined;
  getProduto: (id: string) => Produto | undefined;
  addCliente: (c: Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<Cliente>;
  updateCliente: (id: string, c: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  addVeiculo: (v: Omit<Veiculo, 'id' | 'updated_at' | 'user_id'>) => Promise<Veiculo>;
  deleteVeiculo: (id: string) => Promise<void>;
  addTipoLavagem: (t: Omit<TipoLavagem, 'id'>) => Promise<TipoLavagem>;
  updateTipoLavagem: (id: string, t: Partial<TipoLavagem>) => Promise<void>;
  deleteTipoLavagem: (id: string) => Promise<void>;
  addLavagem: (l: Omit<Lavagem, 'id' | 'data' | 'data_conclusao' | 'updated_at' | 'user_id'>) => Promise<Lavagem>;
  updateLavagem: (id: string, l: Partial<Lavagem>) => Promise<void>;
  updateLavagemStatus: (id: string, status: Lavagem['status']) => Promise<void>;
  deleteLavagem: (id: string) => Promise<void>;
  addProduto: (p: Omit<Produto, 'id' | 'updated_at' | 'user_id'>) => Promise<Produto>;
  updateProduto: (id: string, p: Partial<Produto>) => Promise<void>;
  deleteProduto: (id: string) => Promise<void>;
  addMovimentacao: (m: Omit<MovimentacaoEstoque, 'id' | 'data' | 'updated_at' | 'user_id'>) => Promise<MovimentacaoEstoque>;
  refreshData: () => Promise<void>;
  seedTestData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [state, setState] = useState<AppState>({
    clientes: [],
    veiculos: [],
    tiposLavagem: [],
    lavagens: [],
    produtos: [],
    movimentacoes: [],
  });

  const loadData = useCallback(async () => {
    if (!user) {
      setState({
        clientes: [], veiculos: [], tiposLavagem: [], lavagens: [], produtos: [], movimentacoes: []
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const db = getDatabase();
      const [
        clientes,
        veiculos,
        tiposLavagem,
        lavagens,
        produtos,
        movimentacoes
      ] = await Promise.all([
        db.getClientes(user.id),
        db.getVeiculos(user.id),
        db.getTiposLavagem(),
        db.getLavagens(user.id),
        db.getProdutos(user.id),
        db.getMovimentacoes(user.id)
      ]);

      setState({
        clientes,
        veiculos,
        tiposLavagem,
        lavagens,
        produtos,
        movimentacoes
      });
    } catch (e) {
      console.error('Erro ao carregar do backend:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addCliente = async (data: Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('Usuário não autenticado');
    const db = getDatabase();
    const result = await db.createCliente(user.id, data);
    setState(s => ({ ...s, clientes: [...s.clientes, result] }));
    return result;
  };

  const updateCliente = async (id: string, data: Partial<Cliente>) => {
    const db = getDatabase();
    const result = await db.updateCliente(id, data);
    setState(s => ({ ...s, clientes: s.clientes.map(c => c.id === id ? { ...c, ...result } : c) }));
  };

  const deleteCliente = async (id: string) => {
    const db = getDatabase();
    await db.deleteCliente(id);
    setState(s => ({ 
      ...s, 
      clientes: s.clientes.filter(c => c.id !== id),
      veiculos: s.veiculos.filter(v => v.cliente_id !== id),
      lavagens: s.lavagens.filter(l => l.cliente_id !== id)
    }));
  };

  const addVeiculo = async (data: Omit<Veiculo, 'id' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('Usuário não autenticado');
    const db = getDatabase();
    const result = await db.createVeiculo(user.id, data);
    setState(s => ({ ...s, veiculos: [...s.veiculos, result] }));
    return result;
  };

  const deleteVeiculo = async (id: string) => {
    const db = getDatabase();
    await db.deleteVeiculo(id);
    setState(s => ({ ...s, veiculos: s.veiculos.filter(v => v.id !== id) }));
  };

  const addTipoLavagem = async (data: Omit<TipoLavagem, 'id'>) => {
    const db = getDatabase();
    const result = await db.createTipoLavagem(data);
    setState(s => ({ ...s, tiposLavagem: [...s.tiposLavagem, result] }));
    return result;
  };

  const updateTipoLavagem = async (id: string, data: Partial<TipoLavagem>) => {
    const db = getDatabase();
    const result = await db.updateTipoLavagem(id, data);
    setState(s => ({ ...s, tiposLavagem: s.tiposLavagem.map(t => t.id === id ? { ...t, ...result } : t) }));
  };

  const deleteTipoLavagem = async (id: string) => {
    const db = getDatabase();
    await db.deleteTipoLavagem(id);
    setState(s => ({ ...s, tiposLavagem: s.tiposLavagem.filter(t => t.id !== id) }));
  };

  const addLavagem = async (data: Omit<Lavagem, 'id' | 'data' | 'data_conclusao' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('Usuário não autenticado');
    const db = getDatabase();
    const result = await db.createLavagem(user.id, data);
    setState(s => ({ ...s, lavagens: [result, ...s.lavagens] }));
    return result;
  };

  const updateLavagem = async (id: string, data: Partial<Lavagem>) => {
    const db = getDatabase();
    const result = await db.updateLavagem(id, data);
    setState(s => ({ ...s, lavagens: s.lavagens.map(l => l.id === id ? { ...l, ...result } : l) }));
  };

  const deleteLavagem = async (id: string) => {
    const db = getDatabase();
    await db.deleteLavagem(id);
    setState(s => ({ ...s, lavagens: s.lavagens.filter(l => l.id !== id) }));
  };

  const updateLavagemStatus = async (id: string, status: Lavagem['status']) => {
    const db = getDatabase();
    const result = await db.updateLavagem(id, { status });
    setState(s => ({ ...s, lavagens: s.lavagens.map(l => l.id === id ? { ...l, ...result, status } : l) }));
  };

  // Getters
  const getCliente = (id: string) => state.clientes.find(c => c.id === id);
  const getVeiculosCliente = (clienteId: string) => state.veiculos.filter(v => v.cliente_id === clienteId);
  const getLavagensCliente = (clienteId: string) => state.lavagens.filter(l => l.cliente_id === clienteId);
  const getTipoLavagem = (id: string) => state.tiposLavagem.find(t => t.id === id);
  const getProduto = (id: string) => state.produtos.find(p => p.id === id);
  const produtosBaixoEstoque = state.produtos.filter(p => p.quantidade <= p.estoque_minimo);

  // Seed test data - carrega dados existentes do banco SQLite
  const seedTestData = async () => {
    await loadData(); // Recarrega dados do banco SQLite
  };

  const addProduto = async (data: Omit<Produto, 'id' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('Usuário não autenticado');
    const db = getDatabase();
    const result = await db.createProduto(user.id, data);
    setState(s => ({ ...s, produtos: [...s.produtos, result] }));
    return result;
  };

  const updateProduto = async (id: string, data: Partial<Produto>) => {
    const db = getDatabase();
    const result = await db.updateProduto(id, data);
    setState(s => ({ ...s, produtos: s.produtos.map(p => p.id === id ? { ...p, ...result } : p) }));
  };

  const deleteProduto = async (id: string) => {
    const db = getDatabase();
    await db.deleteProduto(id);
    setState(s => ({ ...s, produtos: s.produtos.filter(p => p.id !== id) }));
  };

  const addMovimentacao = async (data: Omit<MovimentacaoEstoque, 'id' | 'data' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('Usuário não autenticado');
    const db = getDatabase();
    const result = await db.createMovimentacao(user.id, data);
    setState(s => ({ 
      ...s, 
      movimentacoes: [result, ...s.movimentacoes] 
    }));
    return result;
  };

  return (
    <AppContext.Provider value={{
      ...state,
      loading,
      produtosBaixoEstoque,
      getCliente,
      getVeiculosCliente,
      getLavagensCliente,
      getTipoLavagem,
      getProduto,
      refreshData: loadData,
      addCliente, updateCliente, deleteCliente,
      addVeiculo, deleteVeiculo, addTipoLavagem, updateTipoLavagem, deleteTipoLavagem,
      addLavagem, updateLavagem, updateLavagemStatus, deleteLavagem,
      addProduto, updateProduto, deleteProduto,
      addMovimentacao,
      seedTestData
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
