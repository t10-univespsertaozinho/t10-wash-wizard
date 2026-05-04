export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface Veiculo {
  id: string;
  cliente_id: string;
  modelo: string;
  placa: string;
  cor: string;
  user_id: string;
  updated_at?: string;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface TipoLavagem {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
}

export interface Lavagem {
  id: string;
  cliente_id: string;
  veiculo_id: string;
  tipo_lavagem_id: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  pagamento: string;
  valor: number;
  observacao: string;
  user_id: string;
  data: string;
  data_conclusao: string | null;
  updated_at?: string;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface Produto {
  id: string;
  nome: string;
  categoria: 'Limpeza' | 'Polimento' | 'Proteção' | 'Outros';
  quantidade: number;
  estoque_minimo: number;
  unidade: string;
  preco_unitario: number;
  user_id: string;
  updated_at?: string;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface MovimentacaoEstoque {
  id: string;
  produto_id: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  observacao: string;
  user_id: string;
  data: string;
  updated_at?: string;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
}

export type SyncStatus = 'synced' | 'pending' | 'conflict';

export type EntityType = 'cliente' | 'veiculo' | 'lavagem' | 'produto' | 'movimentacao';

export interface Conflict {
  entityType: EntityType;
  entityId: string;
  localData: Cliente | Veiculo | Lavagem | Produto | MovimentacaoEstoque;
  remoteData: Record<string, unknown>;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
}
