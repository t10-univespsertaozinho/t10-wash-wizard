import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Cliente, Veiculo, TipoLavagem, Lavagem, Produto, MovimentacaoEstoque } from '@/types';

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
  addCliente: (c: Omit<Cliente, 'id' | 'created_at'>) => Cliente;
  updateCliente: (id: string, c: Partial<Cliente>) => void;
  deleteCliente: (id: string) => void;
  addVeiculo: (v: Omit<Veiculo, 'id'>) => Veiculo;
  deleteVeiculo: (id: string) => void;
  addTipoLavagem: (t: Omit<TipoLavagem, 'id'>) => void;
  deleteTipoLavagem: (id: string) => void;
  addLavagem: (l: Omit<Lavagem, 'id' | 'data' | 'data_conclusao'>) => void;
  updateLavagemStatus: (id: string, status: Lavagem['status']) => void;
  addProduto: (p: Omit<Produto, 'id'>) => void;
  updateProduto: (id: string, p: Partial<Produto>) => void;
  deleteProduto: (id: string) => void;
  addMovimentacao: (m: Omit<MovimentacaoEstoque, 'id' | 'data'>) => void;
  getCliente: (id: string) => Cliente | undefined;
  getVeiculosCliente: (clienteId: string) => Veiculo[];
  getLavagensCliente: (clienteId: string) => Lavagem[];
  getTipoLavagem: (id: string) => TipoLavagem | undefined;
  getProduto: (id: string) => Produto | undefined;
  produtosBaixoEstoque: Produto[];
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

function loadState(): AppState {
  try {
    const s = localStorage.getItem('t10_state');
    if (s) return JSON.parse(s);
  } catch {}
  return initialState;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    localStorage.setItem('t10_state', JSON.stringify(state));
  }, [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(prev => fn(prev)), []);

  const addCliente = (c: Omit<Cliente, 'id' | 'created_at'>) => {
    const novo: Cliente = { ...c, id: genId(), created_at: now() };
    update(s => ({ ...s, clientes: [...s.clientes, novo] }));
    return novo;
  };
  const updateCliente = (id: string, c: Partial<Cliente>) => update(s => ({
    ...s, clientes: s.clientes.map(x => x.id === id ? { ...x, ...c } : x)
  }));
  const deleteCliente = (id: string) => update(s => ({
    ...s,
    clientes: s.clientes.filter(x => x.id !== id),
    veiculos: s.veiculos.filter(x => x.cliente_id !== id),
    lavagens: s.lavagens.filter(x => x.cliente_id !== id),
  }));
  const addVeiculo = (v: Omit<Veiculo, 'id'>) => {
    const novo: Veiculo = { ...v, id: genId() };
    update(s => ({ ...s, veiculos: [...s.veiculos, novo] }));
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
  const addLavagem = (l: Omit<Lavagem, 'id' | 'data' | 'data_conclusao'>) => update(s => ({
    ...s, lavagens: [...s.lavagens, { ...l, id: genId(), data: now(), data_conclusao: null }]
  }));
  const updateLavagemStatus = (id: string, status: Lavagem['status']) => update(s => ({
    ...s, lavagens: s.lavagens.map(x => x.id === id ? {
      ...x, status, data_conclusao: status === 'concluida' ? now() : x.data_conclusao
    } : x)
  }));
  const addProduto = (p: Omit<Produto, 'id'>) => update(s => ({
    ...s, produtos: [...s.produtos, { ...p, id: genId() }]
  }));
  const updateProduto = (id: string, p: Partial<Produto>) => update(s => ({
    ...s, produtos: s.produtos.map(x => x.id === id ? { ...x, ...p } : x)
  }));
  const deleteProduto = (id: string) => update(s => ({
    ...s, produtos: s.produtos.filter(x => x.id !== id)
  }));
  const addMovimentacao = (m: Omit<MovimentacaoEstoque, 'id' | 'data'>) => {
    update(s => {
      const produto = s.produtos.find(p => p.id === m.produto_id);
      if (!produto) return s;
      const novaQtd = m.tipo === 'entrada'
        ? produto.quantidade + m.quantidade
        : Math.max(0, produto.quantidade - m.quantidade);
      return {
        ...s,
        produtos: s.produtos.map(p => p.id === m.produto_id ? { ...p, quantidade: novaQtd } : p),
        movimentacoes: [...s.movimentacoes, { ...m, id: genId(), data: now() }],
      };
    });
  };

  const getCliente = (id: string) => state.clientes.find(c => c.id === id);
  const getVeiculosCliente = (cid: string) => state.veiculos.filter(v => v.cliente_id === cid);
  const getLavagensCliente = (cid: string) => state.lavagens.filter(l => l.cliente_id === cid);
  const getTipoLavagem = (id: string) => state.tiposLavagem.find(t => t.id === id);
  const getProduto = (id: string) => state.produtos.find(p => p.id === id);
  const produtosBaixoEstoque = state.produtos.filter(p => p.quantidade <= p.estoque_minimo);

  return (
    <AppContext.Provider value={{
      ...state, addCliente, updateCliente, deleteCliente,
      addVeiculo, deleteVeiculo, addTipoLavagem, deleteTipoLavagem,
      addLavagem, updateLavagemStatus, addProduto, updateProduto,
      deleteProduto, addMovimentacao, getCliente, getVeiculosCliente,
      getLavagensCliente, getTipoLavagem, getProduto, produtosBaixoEstoque,
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
