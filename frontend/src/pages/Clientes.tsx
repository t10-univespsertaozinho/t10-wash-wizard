import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { toast } from 'sonner';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { ConfirmDialogButton } from '@/components/ConfirmDialog';

export default function Clientes() {
  const { clientes, veiculos, lavagens, deleteCliente } = useApp();
  const { user } = useAuth();
  const { openNovoCliente } = useModal();
  const podeExcluir = user?.role === 'admin';

  // Sem o try/catch a recusa do backend virava rejeição não tratada e o cliente
  // continuava na lista sem nenhuma explicação.
  const handleDeleteCliente = async (id: string, nome: string) => {
    try {
      await deleteCliente(id);
      toast.success(`Cliente ${nome} excluído.`);
    } catch (err) {
      toast.error(`Não foi possível excluir o cliente: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    }
  };
  const [busca, setBusca] = useState('');

  const filtered = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <label htmlFor="clientes-busca" className="sr-only">Buscar clientes por nome ou telefone</label>
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground" />
          <input id="clientes-busca" type="search" className="input-t10 pl-9" placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={openNovoCliente}
          className="bg-primary text-primary-foreground font-bold h-12 text-base px-5 rounded-lg hover:brightness-110 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> Novo Cliente
        </button>
      </div>
      <div
        className="bg-card rounded-xl border border-border overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela de clientes"
      >
        <table className="w-full text-sm">
                <caption className="sr-only">Clientes cadastrados, com nome, telefone, veículos, lavagens, data de cadastro e ações</caption>
          <thead>
            <tr className="table-header">
              <th scope="col" className="text-left py-4 px-4">Nome</th>
              <th scope="col" className="text-left py-4 px-4">Telefone</th>
              <th scope="col" className="text-center py-4 px-4">Veículos</th>
              <th scope="col" className="text-center py-4 px-4">Lavagens</th>
              <th scope="col" className="text-left py-4 px-4">Cadastro</th>
              <th scope="col" className="text-right py-4 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="table-row-hover border-t border-border">
                <td className="py-4 px-4 text-base font-medium text-foreground">{c.nome}</td>
                <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{c.telefone}</td>
                <td className="py-4 px-4 text-center text-base">{veiculos.filter(v => v.cliente_id === c.id).length}</td>
                <td className="py-4 px-4 text-center text-base">{lavagens.filter(l => l.cliente_id === c.id).length}</td>
                <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to={`/clientes/${c.id}`}
                      aria-label={`Ver detalhes do cliente ${c.nome}`}
                      title="Ver detalhes"
                      className="p-1.5 rounded-lg hover:bg-secondary/60 text-secondary-foreground hover:text-foreground transition-colors"
                    >
                      <Eye size={15} aria-hidden="true" />
                    </Link>
                    <Link
                      to={`/clientes/${c.id}/editar`}
                      aria-label={`Editar cliente ${c.nome}`}
                      title="Editar"
                      className="p-1.5 rounded-lg hover:bg-secondary/60 text-secondary-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </Link>
                    {podeExcluir && (
                      <ConfirmDialogButton
                        title="Excluir Cliente"
                        ariaLabel={`Excluir cliente ${c.nome}`}
                        description={`Tem certeza que deseja excluir o cliente "${c.nome}"? Todos os veículos e lavagens associadas também serão excluídos.`}
                        onConfirm={() => handleDeleteCliente(c.id, c.nome)}
                        icon={<Trash2 size={15} />}
                        variant="ghost"
                      />
                    )}
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
