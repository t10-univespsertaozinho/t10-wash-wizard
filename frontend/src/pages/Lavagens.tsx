import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';
import { Check, X, Pencil, PlayCircle } from 'lucide-react';

export default function Lavagens() {
  const { lavagens, getCliente, getTipoLavagem, veiculos, updateLavagemStatus } = useApp();
  const [filtro, setFiltro] = useState('todos');

  const filtered = filtro === 'todos' ? lavagens : lavagens.filter(l => l.status === filtro);
  const sorted = [...filtered].sort((a, b) => b.data.localeCompare(a.data));

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pendente: 'badge-pendente', em_progresso: 'badge-andamento', concluida: 'badge-concluida', cancelada: 'badge-cancelada' };
    const labels: Record<string, string> = { pendente: 'Pendente', em_progresso: 'Em progresso', concluida: 'Concluída', cancelada: 'Cancelada' };
    return <span className={`text-sm px-3 py-1 rounded-md font-semibold ${map[s] || ''}`}>{labels[s] || s}</span>;
  };

  const filters = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendente', label: 'Pendente' },
    { key: 'em_progresso', label: 'Em progresso' },
    { key: 'concluida', label: 'Concluída' },
    { key: 'cancelada', label: 'Cancelada' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar lavagens por status">
        {filters.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            aria-pressed={filtro === f.key}
            className={`text-sm px-4 py-2 rounded-full font-semibold transition-colors ${filtro === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div
        className="bg-card rounded-xl border border-border overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela de lavagens"
      >
        <table className="w-full text-sm">
                <caption className="sr-only">Lavagens registradas, com data, cliente, veículo, tipo, valor, pagamento, status e ações</caption>
          <thead>
            <tr className="table-header">
              <th scope="col" className="text-left py-4 px-4">Data/Hora</th>
              <th scope="col" className="text-left py-4 px-4">Cliente</th>
              <th scope="col" className="text-left py-4 px-4">Veículo</th>
              <th scope="col" className="text-left py-4 px-4">Tipo</th>
              <th scope="col" className="text-right py-4 px-4">Valor</th>
              <th scope="col" className="text-left py-4 px-4">Pagamento</th>
              <th scope="col" className="text-center py-4 px-4">Status</th>
              <th scope="col" className="text-right py-4 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(l => {
              const c = getCliente(l.cliente_id);
              const v = veiculos.find(x => x.id === l.veiculo_id);
              const t = getTipoLavagem(l.tipo_lavagem_id);
              return (
                <tr key={l.id} className="table-row-hover border-t border-border">
                  <td className="py-4 px-4 text-sm font-medium text-secondary-foreground whitespace-nowrap">{new Date(l.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="py-4 px-4 text-base font-medium text-foreground">{c?.nome || '—'}</td>
                  <td className="py-4 px-4 text-base">{v ? `${v.modelo} ` : '—'}<span className="font-mono text-sm font-medium text-secondary-foreground">{v?.placa}</span></td>
                  <td className="py-4 px-4 text-base">{t?.nome || '—'}</td>
                  <td className="py-4 px-4 text-right text-base text-primary font-semibold">R$ {l.valor.toFixed(2)}</td>
                  <td className="py-4 px-4 text-base font-medium text-secondary-foreground">{l.pagamento}</td>
                  <td className="py-4 px-4 text-center">{statusBadge(l.status)}</td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {l.status === 'pendente' && (
                        <button type="button" onClick={() => updateLavagemStatus(l.id, 'em_progresso')} title="Iniciar lavagem" aria-label={`Iniciar lavagem de ${c?.nome || 'cliente'}`} className="p-1.5 rounded-lg hover:bg-accent/10 text-secondary-foreground hover:text-accent-text transition-colors"><PlayCircle size={15} aria-hidden="true" /></button>
                      )}
                      {(l.status === 'pendente' || l.status === 'em_progresso') && (
                        <button type="button" onClick={() => updateLavagemStatus(l.id, 'concluida')} title="Concluir lavagem" aria-label={`Concluir lavagem de ${c?.nome || 'cliente'}`} className="p-1.5 rounded-lg hover:bg-success/10 text-secondary-foreground hover:text-success transition-colors"><Check size={15} aria-hidden="true" /></button>
                      )}
                      {(l.status === 'pendente' || l.status === 'em_progresso') && (
                        <button type="button" onClick={() => updateLavagemStatus(l.id, 'cancelada')} title="Cancelar lavagem" aria-label={`Cancelar lavagem de ${c?.nome || 'cliente'}`} className="p-1.5 rounded-lg hover:bg-destructive/10 text-secondary-foreground hover:text-destructive transition-colors"><X size={15} aria-hidden="true" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-secondary-foreground">Nenhuma lavagem encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
