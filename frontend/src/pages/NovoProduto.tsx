import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import type { Produto } from '@/types';

export default function NovoProduto() {
  const { addProduto } = useApp();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<Produto['categoria']>('Limpeza');
  const [quantidade, setQuantidade] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [preco, setPreco] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    addProduto({
      nome: nome.trim(), categoria,
      quantidade: parseInt(quantidade) || 0,
      estoque_minimo: parseInt(estoqueMinimo) || 0,
      unidade, preco_unitario: parseFloat(preco) || 0,
    });
    navigate('/estoque');
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5 animate-fade-up">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">Cadastrar Produto</h2>
        <div>
          <label htmlFor="produto-nome" className="block text-base font-semibold text-foreground mb-1.5">Nome</label>
          <input id="produto-nome" className="input-t10" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do produto" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="produto-categoria" className="block text-base font-semibold text-foreground mb-1.5">Categoria</label>
            <select id="produto-categoria" className="input-t10" value={categoria} onChange={e => setCategoria(e.target.value as Produto['categoria'])}>
              <option>Limpeza</option><option>Polimento</option><option>Proteção</option><option>Outros</option>
            </select>
          </div>
          <div>
            <label htmlFor="produto-unidade" className="block text-base font-semibold text-foreground mb-1.5">Unidade</label>
            <select id="produto-unidade" className="input-t10" value={unidade} onChange={e => setUnidade(e.target.value)}>
              <option value="un">un</option><option value="L">L</option><option value="ml">ml</option><option value="kg">kg</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="produto-quantidade" className="block text-base font-semibold text-foreground mb-1.5">Qtd Inicial</label>
            <input id="produto-quantidade" className="input-t10" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="produto-estoque-minimo" className="block text-base font-semibold text-foreground mb-1.5">Estoque Mín.</label>
            <input id="produto-estoque-minimo" className="input-t10" type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="produto-preco" className="block text-base font-semibold text-foreground mb-1.5">Preço (R$)</label>
            <input id="produto-preco" className="input-t10" type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold h-12 rounded-lg hover:brightness-110 transition-all text-base">Cadastrar Produto</button>
      </form>
    </div>
  );
}
