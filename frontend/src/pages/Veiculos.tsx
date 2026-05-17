import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Car, Plus, Trash2, Search } from 'lucide-react';
import { usePlacaMask } from '@/hooks/usePlacaMask';
import { ConfirmDialogButton } from '@/components/ConfirmDialog';

export default function Veiculos() {
  const { veiculos, clientes, addVeiculo, deleteVeiculo } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [modelo, setModelo] = useState('');
  const [cor, setCor] = useState('');
  const [busca, setBusca] = useState('');
  const { value: placa, handleChange: handlePlacaChange, setValue: setPlaca } = usePlacaMask();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !modelo.trim() || !placa.trim()) return;
    await addVeiculo({ cliente_id: clienteId, modelo: modelo.trim(), placa: placa.trim(), cor: cor.trim() });
    setClienteId(''); setModelo(''); setPlaca(''); setCor(''); setShowForm(false);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-barlow-condensed font-bold text-foreground flex items-center gap-2">
            <Car size={18} /> Cadastro de Veículos
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-t10 pl-9 text-sm py-1.5"
                placeholder="Buscar por modelo, placa ou cliente..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-xs bg-primary text-primary-foreground px-3 py-2 rounded-lg font-semibold hover:brightness-110 transition-all flex items-center gap-1"
            >
              <Plus size={12} /> Novo Veículo
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 p-4 bg-secondary/40 rounded-lg">
            <select
              className="input-t10"
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              required
            >
              <option value="">Selecione o cliente</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <input className="input-t10" placeholder="Modelo" value={modelo} onChange={e => setModelo(e.target.value)} required />
            <input className="input-t10 uppercase font-mono" placeholder="ABC1D23 ou ABC1234" value={placa} onChange={handlePlacaChange} maxLength={8} required />
            <div className="flex gap-2">
              <input className="input-t10 flex-1" placeholder="Cor" value={cor} onChange={e => setCor(e.target.value)} />
              <button type="submit" className="bg-primary text-primary-foreground px-4 rounded-lg font-bold text-sm hover:brightness-110 transition-all whitespace-nowrap">
                Salvar
              </button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="text-left py-2 px-3">Cliente</th>
              <th className="text-left py-2 px-3">Modelo</th>
              <th className="text-left py-2 px-3">Placa</th>
              <th className="text-left py-2 px-3">Cor</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(v => {
              const cliente = clientes.find(c => c.id === v.cliente_id);
              return (
                <tr key={v.id} className="table-row-hover border-t border-border">
                  <td className="py-2 px-3 font-medium text-foreground">{cliente?.nome || '—'}</td>
                  <td className="py-2 px-3">{v.modelo}</td>
                  <td className="py-2 px-3 font-mono text-primary text-xs">{v.placa}</td>
                  <td className="py-2 px-3 text-muted-foreground">{v.cor}</td>
                  <td className="py-2 px-3 text-right">
                    <ConfirmDialogButton
                      title="Excluir Veículo"
                      description={`Tem certeza que deseja excluir o veículo "${v.modelo}"?`}
                      onConfirm={() => deleteVeiculo(v.id)}
                      icon={<Trash2 size={14} />}
                      variant="ghost"
                    />
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">Nenhum veículo cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}