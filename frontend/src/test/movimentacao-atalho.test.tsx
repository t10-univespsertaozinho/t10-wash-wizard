/**
 * Atalho do estoque para a movimentação (`/movimentacao?produto=<id>`).
 *
 * A linha do estoque não abre mais um modal próprio: ela navega para a página
 * de movimentação com o produto na query string. Este teste garante que a
 * página lê o parâmetro e pré-seleciona o produto, sem quebrar em id inválido.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Movimentacao from '@/pages/Movimentacao';

const produtos = vi.hoisted(() => [
  {
    id: 'p1',
    nome: 'Shampoo',
    categoria: 'Química',
    quantidade: 2,
    unidade: 'L',
    estoque_minimo: 5,
    preco_unitario: 20,
  },
  {
    id: 'p2',
    nome: 'Cera',
    categoria: 'Acabamento',
    quantidade: 10,
    unidade: 'un',
    estoque_minimo: 3,
    preco_unitario: 35,
  },
]);

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    produtos,
    movimentacoes: [],
    getProduto: (id: string) => produtos.find((p) => p.id === id),
    addMovimentacao: vi.fn(),
  }),
}));

const renderizar = (entrada: string) =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Movimentacao />
    </MemoryRouter>
  );

describe('Movimentacao — atalho por query string', () => {
  it('pré-seleciona o produto indicado em ?produto=', () => {
    renderizar('/movimentacao?produto=p2');

    expect(screen.getByLabelText('Produto')).toHaveValue('p2');
  });

  it('ignora um id que não existe no estoque', () => {
    renderizar('/movimentacao?produto=inexistente');

    expect(screen.getByLabelText('Produto')).toHaveValue('');
  });

  it('sem query string, o formulário começa vazio', () => {
    renderizar('/movimentacao');

    expect(screen.getByLabelText('Produto')).toHaveValue('');
  });
});
