/**
 * Regressão de `EditarCliente`.
 *
 * `data_nascimento` é opcional (`string | null`) e o dataset — inclusive o
 * demo, por exigência do portão de privacidade — grava `null`. Antes da
 * correção, o formulário jogava o nulo direto no `useState` e o `handleSubmit`
 * chamava `.trim()`, o que estourava `TypeError` ao salvar qualquer cliente
 * sem data de nascimento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EditarCliente from '@/pages/EditarCliente';

const app = vi.hoisted(() => ({
  cliente: {
    id: 'c1',
    nome: 'Cliente Um',
    telefone: '00999990000',
    data_nascimento: null as string | null,
  },
  updateCliente: vi.fn(),
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    getCliente: () => app.cliente,
    updateCliente: app.updateCliente,
  }),
}));

const renderizar = () =>
  render(
    <MemoryRouter initialEntries={['/clientes/c1/editar']}>
      <Routes>
        <Route path="/clientes/:id/editar" element={<EditarCliente />} />
        <Route path="/clientes/:id" element={<h1>Detalhe do cliente</h1>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  app.updateCliente.mockClear();
  app.cliente.data_nascimento = null;
});

describe('EditarCliente — data de nascimento opcional', () => {
  it('salva cliente com data nula sem lançar erro', async () => {
    renderizar();

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Cliente Editado' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    expect(app.updateCliente).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        nome: 'Cliente Editado',
        data_nascimento: null,
      }),
    );
    expect(await screen.findByText('Detalhe do cliente')).toBeInTheDocument();
  });

  it('envia a data digitada quando preenchida', () => {
    app.cliente.data_nascimento = '1990-05-04';
    renderizar();

    fireEvent.change(screen.getByLabelText(/Data de Nascimento/i), {
      target: { value: '1990-05-05' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    expect(app.updateCliente).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ data_nascimento: '1990-05-05' }),
    );
  });

  it('limita o nome a 60 caracteres', () => {
    renderizar();

    expect(screen.getByLabelText(/Nome Completo/i)).toHaveAttribute(
      'maxlength',
      '60',
    );
  });
});
