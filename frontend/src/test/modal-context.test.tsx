/**
 * ModalContext (CRUD de modais globais do app).
 *
 * O provider renderiza os dois modais de cadastro e expõe para a árvore as
 * funções de abrir/fechar. Como os componentes `Modal*` reais dependem do
 * `AppContext`, eles são dublados aqui: o objetivo é o contrato do contexto
 * (estado + guarda de uso), não o conteúdo dos formulários.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalProvider, useModal } from '@/contexts/ModalContext';

vi.mock('@/components/modals/NovaLavagemModal', () => ({
  NovaLavagemModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="modal-lavagem">Nova Lavagem</div> : null,
}));

vi.mock('@/components/modals/NovoClienteModal', () => ({
  NovoClienteModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="modal-cliente">Novo Cliente</div> : null,
}));

function BotoesDeDisparo() {
  const { openNovaLavagem, openNovoCliente, closeNovaLavagem, closeNovoCliente } = useModal();
  return (
    <>
      <button type="button" onClick={openNovaLavagem}>abrir lavagem</button>
      <button type="button" onClick={openNovoCliente}>abrir cliente</button>
      <button type="button" onClick={closeNovaLavagem}>fechar lavagem</button>
      <button type="button" onClick={closeNovoCliente}>fechar cliente</button>
    </>
  );
}

function UsaModalForaDoProvider() {
  useModal();
  return null;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ModalContext', () => {
  it('openNovaLavagem() abre o NovaLavagemModal', () => {
    render(
      <ModalProvider>
        <BotoesDeDisparo />
      </ModalProvider>
    );

    expect(screen.queryByTestId('modal-lavagem')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abrir lavagem' }));
    expect(screen.getByTestId('modal-lavagem')).toBeInTheDocument();
  });

  it('openNovoCliente() abre o NovoClienteModal', () => {
    render(
      <ModalProvider>
        <BotoesDeDisparo />
      </ModalProvider>
    );

    expect(screen.queryByTestId('modal-cliente')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abrir cliente' }));
    expect(screen.getByTestId('modal-cliente')).toBeInTheDocument();
  });

  it('fecha o modal ao chamar o close correspondente', () => {
    render(
      <ModalProvider>
        <BotoesDeDisparo />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'abrir lavagem' }));
    expect(screen.getByTestId('modal-lavagem')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'fechar lavagem' }));
    expect(screen.queryByTestId('modal-lavagem')).not.toBeInTheDocument();
  });

  it('useModal fora do ModalProvider lança erro de contrato', () => {
    expect(() => render(<UsaModalForaDoProvider />)).toThrow(
      'useModal must be used within a ModalProvider'
    );
  });
});