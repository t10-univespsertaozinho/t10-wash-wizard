/**
 * Gatilhos de UI dos modais de cadastro.
 *
 * O `modal-context.test.tsx` cobre o contrato do contexto: ele chama os
 * openers direto. Isso passava mesmo quando nenhuma tela chamava
 * `openNovoVeiculo`/`openNovoServico` — os modais existiam, mas eram
 * inalcançáveis. Estes testes clicam nos botões reais das páginas e conferem
 * os argumentos entregues ao contexto, fechando o elo UI → modal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TiposLavagem from '@/pages/TiposLavagem';
import Veiculos from '@/pages/Veiculos';
import Estoque from '@/pages/Estoque';

const modal = vi.hoisted(() => ({
  openNovaLavagem: vi.fn(),
  openNovoCliente: vi.fn(),
  openNovoVeiculo: vi.fn(),
  openNovoServico: vi.fn(),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => modal,
}));

const dados = vi.hoisted(() => ({
  tiposLavagem: [{ id: 't1', nome: 'Lavagem Simples', descricao: 'Externa', preco: 30 }],
  veiculos: [{ id: 'v1', cliente_id: 'c1', modelo: 'Gol', placa: 'ABC1234', cor: 'Branco' }],
  clientes: [{ id: 'c1', nome: 'Cliente Um' }],
  produtos: [
    {
      id: 'p1',
      nome: 'Shampoo',
      categoria: 'Química',
      quantidade: 2,
      unidade: 'L',
      estoque_minimo: 5,
      preco_unitario: 20,
    },
  ],
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    tiposLavagem: dados.tiposLavagem,
    veiculos: dados.veiculos,
    clientes: dados.clientes,
    produtos: dados.produtos,
    produtosBaixoEstoque: dados.produtos,
    deleteTipoLavagem: vi.fn(),
    deleteVeiculo: vi.fn(),
    deleteProduto: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}));

vi.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialogButton: ({ ariaLabel }: { ariaLabel: string }) => (
    <button type="button" aria-label={ariaLabel} />
  ),
}));

const renderizar = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Gatilhos de cadastro — Tipos de Lavagem', () => {
  it('"Novo Serviço" abre o modal em modo criação', () => {
    renderizar(<TiposLavagem />);

    fireEvent.click(screen.getByRole('button', { name: /Novo Serviço/i }));

    expect(modal.openNovoServico).toHaveBeenCalledTimes(1);
    expect(modal.openNovoServico.mock.calls[0]).toEqual([]);
  });

  it('editar na linha abre o modal com o id do serviço', () => {
    renderizar(<TiposLavagem />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Editar tipo de lavagem Lavagem Simples' })
    );

    expect(modal.openNovoServico).toHaveBeenCalledWith('t1');
  });
});

describe('Gatilhos de cadastro — Veículos', () => {
  it('"Novo Veículo" abre o modal em modo criação', () => {
    renderizar(<Veiculos />);

    fireEvent.click(screen.getByRole('button', { name: /Novo Veículo/i }));

    expect(modal.openNovoVeiculo).toHaveBeenCalledTimes(1);
    expect(modal.openNovoVeiculo.mock.calls[0]).toEqual([]);
  });

  it('editar na linha abre o modal com o id do veículo', () => {
    renderizar(<Veiculos />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Editar veículo Gol, placa ABC1234' })
    );

    expect(modal.openNovoVeiculo).toHaveBeenCalledWith(undefined, 'v1');
  });
});

describe('Gatilho de movimentação — Estoque', () => {
  it('o atalho da linha leva à página de movimentação com o produto na URL', () => {
    renderizar(<Estoque />);

    const link = screen.getByRole('link', { name: 'Movimentar estoque de Shampoo' });

    expect(link).toHaveAttribute('href', '/movimentacao?produto=p1');
  });
});
