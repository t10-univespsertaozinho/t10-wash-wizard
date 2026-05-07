import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Pencil, Trash2 } from 'lucide-react';

export default function Clientes() {
  const { clientes, veiculos, lavagens, deleteCliente } = useApp();
  const [busca, setBusca] = useState('');

  const filtered = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca)
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input className="input-t10 pl-9" placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="text-left py-3 px-4">Nome</th>
              <th className="text-left py-3 px-4">Telefone</th>
              <th className="text-center py-3 px-4">Veículos</th>
              <th className="text-center py-3 px-4">Lavagens</th>
              <th className="text-left py-3 px-4">Cadastro</th>
              <th className="text-right py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="table-row-hover border-t border-border">
                <td className="py-3 px-4 font-medium text-foreground">{c.nome}</td>
                <td className="py-3 px-4 text-muted-foreground">{c.telefone}</td>
                <td className="py-3 px-4 text-center">{veiculos.filter(v => v.cliente_id === c.id).length}</td>
                <td className="py-3 px-4 text-center">{lavagens.filter(l => l.cliente_id === c.id).length}</td>
                <td className="py-3 px-4 text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/clientes/${c.id}`} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"><Eye size={15} /></Link>
                    <Link to={`/clientes/${c.id}/editar`} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={15} /></Link>
                    <button onClick={() => deleteCliente(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
