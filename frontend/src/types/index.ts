export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  user_id: string;
  created_at: string;
  updated_at?: string;

}

export interface Veiculo {
  id: string;
  cliente_id: string;
  modelo: string;
  placa: string;
  cor: string;
  user_id: string;
  updated_at?: string;

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
  status: 'pendente' | 'em_progresso' | 'concluida' | 'cancelada';
  pagamento: string;
  valor: number;
  observacao: string;
  user_id: string;
  data: string;
  data_conclusao: string | null;
  updated_at?: string;

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

export interface FluxoDiarioItem {
  data: string;
  dia: string;
  lavagens: number;
  receita: number;
}

export interface DashboardStats {
  financeiro: {
    receita_semana: number;
    lavagens_semana: number;
    ticket_medio: number;
    receita_semana_anterior: number;
    lavagens_semana_anterior: number;
    variacao_receita_pct: number;
    variacao_ticket_pct: number;
    fluxo_diario_7d: FluxoDiarioItem[];
  };
  fidelizacao: {
    total_clientes_com_lavagem: number;
    clientes_recorrentes: number;
    taxa_recorrencia_pct: number;
  };
  clientes_ausentes: Array<{
    id: string;
    nome: string;
    telefone: string;
    ultima_visita: string;
    dias_ausente: number;
    historico_lavagens: number;
  }>;
  mix_servicos: Array<{
    id: string;
    nome: string;
    total_atendimentos: number;
    faturamento_total: number;
    pct_volume: number;
    pct_receita: number;
  }>;
  estoque_critico: Array<{
    id: string;
    nome: string;
    quantidade: number;
    estoque_minimo: number;
    unidade: string;
    consumo_diario: number;
    dias_restantes: number | null;
    status_previsao: 'zerado' | 'urgente' | 'atencao' | 'moderado' | 'repor';
  }>;
  pagamentos: Array<{
    forma_pagamento: string;
    lavagens: number;
    receita: number;
    pct_receita: number;
  }>;
  desempenho_operadores: Array<{
    id: string;
    nome: string;
    total_lavagens: number;
    receita: number;
    ticket_medio: number;
  }>;
  tempo_atendimento: {
    total_finalizadas: number;
    tempo_medio_min: number;
  };
}
