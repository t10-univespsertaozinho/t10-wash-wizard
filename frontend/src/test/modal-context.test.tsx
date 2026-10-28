/**
 * ModalContext (CRUD de modais globais do app).
 *
 * O provider renderiza os modais de cadastro e expõe para a árvore as funções
 * de abrir/fechar. Como os componentes `Modal*` reais dependem do
 * `AppContext`, eles são dublados aqui: o objetivo é o contrato do contexto
 * (estado + guarda de uso), não o conteúdo dos formulários.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalProvider, useModal } from '@/contexts/ModalContext';
import { AppProvider } from '@/contexts/AppContext';

vi.mock('@/components/modals/NovaLavagemModal', () => ({
  NovaLavagemModal: ({ isOpen, lavagemId }: { isOpen: boolean; lavagemId?: string | null }) =>
    isOpen ? (
      <div data-testid="modal-lavagem" data-id-edicao={lavagemId ?? ''}>Nova Lavagem</div>
    ) : null,
}));

vi.mock('@/components/modals/NovoClienteModal', () => ({
  NovoClienteModal: ({ isOpen, clienteId }: { isOpen: boolean; clienteId?: string | null }) =>
    isOpen ? (
      <div data-testid="modal-cliente" data-id-edicao={clienteId ?? ''}>Novo Cliente</div>
    ) : null,
}));

vi.mock('@/components/modals/NovoVeiculoModal', () => ({
  NovoVeiculoModal: ({
    isOpen,
    veiculoId,
    clienteId,
  }: {
    isOpen: boolean;
    veiculoId?: string | null;
    clienteId?: string | null;
  }) =>
    isOpen ? (
      <div
        data-testid="modal-veiculo"
        data-id-edicao={veiculoId ?? ''}
        data-cliente-id={clienteId ?? ''}
      >
        Novo Veículo
      </div>
    ) : null,
}));

vi.mock('@/components/modals/NovoServicoModal', () => ({
  NovoServicoModal: ({ isOpen, servicoId }: { isOpen: boolean; servicoId?: string | null }) =>
    isOpen ? (
      <div data-testid="modal-servico" data-id-edicao={servicoId ?? ''}>Novo Serviço</div>
    ) : null,
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    clientes: [],
    veiculos: [],
    tiposLavagem: [],
    lavagens: [],
    produtos: [],
    movimentacoes: [],
  }),
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function BotoesDeDisparo() {
  const {
    openNovaLavagem,
    openNovoCliente,
    openNovoVeiculo,
    openNovoServico,
    closeNovaLavagem,
    closeNovoCliente,
    closeNovoVeiculo,
    closeNovoServico,
  } = useModal();
  return (
    <>
      <button type="button" onClick={openNovaLavagem}>abrir lavagem</button>
      <button type="button" onClick={openNovoCliente}>abrir cliente</button>
      <button type="button" onClick={() => openNovoVeiculo()}>abrir veículo</button>
      <button type="button" onClick={() => openNovoVeiculo('cliente-1', 'veiculo-1')}>editar veículo</button>
      <button type="button" onClick={() => openNovoServico()}>abrir serviço</button>
      <button type="button" onClick={() => openNovoServico('servico-1')}>editar serviço</button>
      <button type="button" onClick={closeNovaLavagem}>fechar lavagem</button>
      <button type="button" onClick={closeNovoCliente}>fechar cliente</button>
      <button type="button" onClick={closeNovoVeiculo}>fechar veículo</button>
      <button type="button" onClick={closeNovoServico}>fechar serviço</button>
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
      <AppProvider>
        <ModalProvider>
          <BotoesDeDisparo />
        </ModalProvider>
      </AppProvider>
    );

    expect(screen.queryByTestId('modal-lavagem')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abrir lavagem' }));
    expect(screen.getByTestId('modal-lavagem')).toBeInTheDocument();
  });

  it('openNovoCliente() abre o NovoClienteModal', () => {
    render(
      <AppProvider>
        <ModalProvider>
          <BotoesDeDisparo />
        </ModalProvider>
      </AppProvider>
    );

    expect(screen.queryByTestId('modal-cliente')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abrir cliente' }));
    expect(screen.getByTestId('modal-cliente')).toBeInTheDocument();
  });

  it('openNovoVeiculo() abre o modal de cadastro e o modo edição com ids', () => {
    render(
      <AppProvider>
        <ModalProvider>
          <BotoesDeDisparo />
        </ModalProvider>
      </AppProvider>
    );

    expect(screen.queryByTestId('modal-veiculo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abrir veículo' }));
    expect(screen.getByTestId('modal-veiculo')).toHaveAttribute('data-id-edicao', '');
    expect(screen.getByTestId('modal-veiculo')).toHaveAttribute('data-cliente-id', '');

    fireEvent.click(screen.getByRole('button', { name: 'fechar veículo' }));
    expect(screen.queryByTestId('modal-veiculo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'editar veículo' }));
    expect(screen.getByTestId('modal-veiculo')).toHaveAttribute('data-id-edicao', 'veiculo-1');
    expect(screen.getByTestId('modal-veiculo')).toHaveAttribute('data-cliente-id', 'cliente-1');
  });

  it('openNovoServico() abre o modal de cadastro e o modo edição com id', () => {
    render(
      <AppProvider>
        <ModalProvider>
          <BotoesDeDisparo />
        </ModalProvider>
      </AppProvider>
    );

    expect(screen.queryByTestId('modal-servico')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abrir serviço' }));
    expect(screen.getByTestId('modal-servico')).toHaveAttribute('data-id-edicao', '');

    fireEvent.click(screen.getByRole('button', { name: 'fechar serviço' }));
    expect(screen.queryByTestId('modal-servico')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'editar serviço' }));
    expect(screen.getByTestId('modal-servico')).toHaveAttribute('data-id-edicao', 'servico-1');
  });

  it('fecha o modal ao chamar o close correspondente', () => {
    render(
      <AppProvider>
        <ModalProvider>
          <BotoesDeDisparo />
        </ModalProvider>
      </AppProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'abrir lavagem' }));
    expect(screen.getByTestId('modal-lavagem')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'fechar lavagem' }));
    expect(screen.queryByTestId('modal-lavagem')).not.toBeInTheDocument();
  });

  /**
   * Regressão: Dashboard/Lavagens/Clientes usam `onClick={open...}` sem arrow,
   * então o React entrega o SyntheticEvent como primeiro argumento. Qualquer
   * objeto é truthy e virava "id de edição" — o modal de cadastro abria com
   * título "Editar ..." e botão "Atualizar ..." para um registro inexistente.
   */
  it('clique sem arrow não é confundido com id de edição', () => {
    render(
      <AppProvider>
        <ModalProvider>
          <BotoesDeDisparo />
        </ModalProvider>
      </AppProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'abrir lavagem' }));
    fireEvent.click(screen.getByRole('button', { name: 'abrir cliente' }));

    expect(screen.getByTestId('modal-lavagem')).toHaveAttribute('data-id-edicao', '');
    expect(screen.getByTestId('modal-cliente')).toHaveAttribute('data-id-edicao', '');
  });

  it('useModal fora do ModalProvider lança erro de contrato', () => {
    expect(() => render(<UsaModalForaDoProvider />)).toThrow(
      'useModal must be used within a ModalProvider'
    );
  });
});