import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { toast } from 'sonner';
import { Car, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { ConfirmDialogButton } from '@/components/ConfirmDialog';

export default function Veiculos() {
  const { veiculos, clientes, deleteVeiculo } = useApp();
  const { openNovoVeiculo } = useModal();
  const { user } = useAuth();
  const podeExcluir = user?.role === 'admin';

  const handleDeleteVeiculo = async (id: string, placaVeiculo: string) => {
    try {
      await deleteVeiculo(id);
      toast.success(`Veículo ${placaVeiculo} excluído.`);
    } catch (err) {
      toast.error(`Não foi possível excluir o veículo: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    }
  };
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return veiculos;
    return veiculos.filter(v => {
      const c = clientes.find(c => c.id === v.cliente_id);
      return v.modelo.toLowerCase().includes(q) ||
        v.placa.toLowerCase().includes(q) ||
        (c?.nome.toLowerCase().includes(q) ?? false);
    });
  }, [veiculos, clientes, busca]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-barlow-condensed font-bold text-foreground flex items-center gap-2">
            <Car size={18} /> Cadastro de Veículos
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground" />
              <input
                id="veiculos-busca"
                type="search"
                aria-label="Buscar veículos por modelo, placa ou cliente"
                className="input-t10 pl-9"
                placeholder="Buscar por modelo, placa ou cliente..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => openNovoVeiculo()}
              className="text-base bg-primary text-primary-foreground h-12 px-6 rounded-lg font-bold hover:brightness-110 transition-all flex items-center gap-1"
            >
              <Plus size={18} /> Novo Veículo
            </button>
          </div>
        </div>

        {/* WCAG 2.1.1 / 1.4.10 - regiao rolavel por teclado, com rotulo para leitores de tela */}
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de veículos">
          <table className="w-full text-sm">
            <caption className="sr-only">Veículos cadastrados, com cliente, modelo, placa, cor e ações</caption>
            <thead>
              <tr className="table-header">
                <th scope="col" className="text-left py-4 px-4">Cliente</th>
                <th scope="col" className="text-left py-4 px-4">Modelo</th>
                <th scope="col" className="text-left py-4 px-4">Placa</th>
                <th scope="col" className="text-left py-4 px-4">Cor</th>
                <th scope="col" className="py-4 px-4"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(v => {
                const cliente = clientes.find(c => c.id === v.cliente_id);
                return (
                  <tr key={v.id} className="table-row-hover border-t border-border">
                    <td className="py-4 px-4 text-base font-medium text-foreground">{cliente?.nome || '—'}</td>
                    <td className="py-4 px-4 text-base">{v.modelo}</td>
                    <td className="py-4 px-4 font-mono text-sm font-medium text-muted-foreground">{v.placa}</td>
                    <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{v.cor}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openNovoVeiculo(undefined, v.id)}
                          aria-label={`Editar veículo ${v.modelo}, placa ${v.placa}`}
                          title="Editar"
                          className="text-secondary-foreground hover:text-primary transition-colors p-1"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        {podeExcluir && (
                          <ConfirmDialogButton
                            title="Excluir Veículo"
                            ariaLabel={`Excluir veículo ${v.modelo}, placa ${v.placa}`}
                            description={`Tem certeza que deseja excluir o veículo "${v.modelo}"?`}
                            onConfirm={() => handleDeleteVeiculo(v.id, v.placa)}
                            icon={<Trash2 size={14} />}
                            variant="ghost"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Nenhum veículo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
