import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';

export default function Lavagens() {
  const { lavagens, getCliente, getTipoLavagem, veiculos, updateLavagemStatus } = useApp();
  const [filtro, setFiltro] = useState('todos');

  const filtered = filtro === 'todos' ? lavagens : lavagens.filter(l => l.status === filtro);
  const sorted = [...filtered].sort((a, b) => b.data.localeCompare(a.data));

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pendente: 'badge-pendente', em_andamento: 'badge-andamento', concluida: 'badge-concluida', cancelada: 'badge-cancelada' };
    const labels: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
    return <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${map[s] || ''}`}>{labels[s] || s}</span>;
  };

  const filters = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendente', label: 'Pendente' },
    { key: 'em_andamento', label: 'Em andamento' },
    { key: 'concluida', label: 'Concluída' },
    { key: 'cancelada', label: 'Cancelada' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`text-xs px-4 py-1.5 rounded-full font-semibold transition-colors ${filtro === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="text-left py-3 px-4">Data/Hora</th>
              <th className="text-left py-3 px-4">Cliente</th>
              <th className="text-left py-3 px-4">Veículo</th>
              <th className="text-left py-3 px-4">Tipo</th>
              <th className="text-right py-3 px-4">Valor</th>
              <th className="text-left py-3 px-4">Pagamento</th>
              <th className="text-center py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(l => {
              const c = getCliente(l.cliente_id);
              const v = veiculos.find(x => x.id === l.veiculo_id);
              const t = getTipoLavagem(l.tipo_lavagem_id);
              return (
                <tr key={l.id} className="table-row-hover border-t border-border">
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(l.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{c?.nome || '—'}</td>
                  <td className="py-3 px-4">{v ? `${v.modelo} ` : '—'}<span className="font-mono text-xs text-primary">{v?.placa}</span></td>
                  <td className="py-3 px-4">{t?.nome || '—'}</td>
                  <td className="py-3 px-4 text-right text-primary font-semibold">R$ {l.valor.toFixed(2)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{l.pagamento}</td>
                  <td className="py-3 px-4 text-center">{statusBadge(l.status)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(l.status === 'pendente' || l.status === 'em_andamento') && (
                        <button onClick={() => updateLavagemStatus(l.id, 'concluida')} className="p-1.5 rounded-lg hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"><Check size={15} /></button>
                      )}
                      {l.status === 'pendente' && (
                        <button onClick={() => updateLavagemStatus(l.id, 'cancelada')} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma lavagem encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
