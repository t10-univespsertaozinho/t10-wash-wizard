import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { NovaLavagemModal } from "@/components/modals/NovaLavagemModal";
import { NovoClienteModal } from "@/components/modals/NovoClienteModal";
import { NovoVeiculoModal } from "@/components/modals/NovoVeiculoModal";
import { NovoServicoModal } from "@/components/modals/NovoServicoModal";
import { MovimentacaoEstoqueModal } from "@/components/modals/MovimentacaoEstoqueModal";

interface ModalContextType {
  // Modal de Lavagens (Criar / Editar)
  novaLavagemOpen: boolean;
  selectedLavagemId?: string | null;
  openNovaLavagem: (id?: string) => void;
  closeNovaLavagem: () => void;

  // Modal de Clientes (Criar / Editar - inclui data_nascimento)
  novoClienteOpen: boolean;
  selectedClienteId?: string | null;
  openNovoCliente: (id?: string) => void;
  closeNovoCliente: () => void;

  // Modal de Veículos (Vincular ao cliente / Editar)
  novoVeiculoOpen: boolean;
  selectedVeiculoId?: string | null;
  selectedClienteForVeiculoId?: string | null;
  openNovoVeiculo: (clienteId?: string, veiculoId?: string) => void;
  closeNovoVeiculo: () => void;

  // Modal de Serviços / Tipos de Lavagem (Criar / Editar)
  novoServicoOpen: boolean;
  selectedServicoId?: string | null;
  openNovoServico: (id?: string) => void;
  closeNovoServico: () => void;

  // Modal de Estoque / Movimentações (Entrada / Saída)
  movimentacaoEstoqueOpen: boolean;
  selectedProdutoId?: string | null;
  openMovimentacaoEstoque: (produtoId?: string) => void;
  closeMovimentacaoEstoque: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

/**
 * Normaliza o "id de edição" recebido pelos abridores de modal.
 *
 * `onClick={openNovoCliente}` — sem arrow, como estava em Dashboard, Lavagens e
 * Clientes — entrega o SyntheticEvent do React como primeiro argumento. Como
 * qualquer objeto é truthy, o evento era interpretado como id: o modal de
 * cadastro abria em modo edição, com título "Editar ..." e botão "Atualizar ..."
 * para um registro que nem existe. Só string não vazia vale como id.
 */
function idValido(valor?: string | null): string | null {
  return typeof valor === "string" && valor.length > 0 ? valor : null;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  // Estados de visibilidade dos modais
  const [novaLavagemOpen, setNovaLavagemOpen] = useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [novoVeiculoOpen, setNovoVeiculoOpen] = useState(false);
  const [novoServicoOpen, setNovoServicoOpen] = useState(false);
  const [movimentacaoEstoqueOpen, setMovimentacaoEstoqueOpen] = useState(false);

  // Estados de IDs selecionados para edição ou associação
  const [selectedLavagemId, setSelectedLavagemId] = useState<string | null>(
    null,
  );
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    null,
  );
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string | null>(
    null,
  );
  const [selectedClienteForVeiculoId, setSelectedClienteForVeiculoId] =
    useState<string | null>(null);
  const [selectedServicoId, setSelectedServicoId] = useState<string | null>(
    null,
  );
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(
    null,
  );

  // Handlers - Lavagem
  const openNovaLavagem = useCallback((id?: string) => {
    setSelectedLavagemId(idValido(id));
    setNovaLavagemOpen(true);
  }, []);

  const closeNovaLavagem = useCallback(() => {
    setNovaLavagemOpen(false);
    setSelectedLavagemId(null);
  }, []);

  // Handlers - Cliente
  const openNovoCliente = useCallback((id?: string) => {
    setSelectedClienteId(idValido(id));
    setNovoClienteOpen(true);
  }, []);

  const closeNovoCliente = useCallback(() => {
    setNovoClienteOpen(false);
    setSelectedClienteId(null);
  }, []);

  // Handlers - Veículo
  const openNovoVeiculo = useCallback(
    (clienteId?: string, veiculoId?: string) => {
      setSelectedClienteForVeiculoId(idValido(clienteId));
      setSelectedVeiculoId(idValido(veiculoId));
      setNovoVeiculoOpen(true);
    },
    [],
  );

  const closeNovoVeiculo = useCallback(() => {
    setNovoVeiculoOpen(false);
    setSelectedClienteForVeiculoId(null);
    setSelectedVeiculoId(null);
  }, []);

  // Handlers - Serviços / Tipos de Lavagem
  const openNovoServico = useCallback((id?: string) => {
    setSelectedServicoId(idValido(id));
    setNovoServicoOpen(true);
  }, []);

  const closeNovoServico = useCallback(() => {
    setNovoServicoOpen(false);
    setSelectedServicoId(null);
  }, []);

  // Handlers - Movimentação de Estoque
  const openMovimentacaoEstoque = useCallback((produtoId?: string) => {
    setSelectedProdutoId(idValido(produtoId));
    setMovimentacaoEstoqueOpen(true);
  }, []);

  const closeMovimentacaoEstoque = useCallback(() => {
    setMovimentacaoEstoqueOpen(false);
    setSelectedProdutoId(null);
  }, []);

  return (
    <ModalContext.Provider
      value={{
        novaLavagemOpen,
        selectedLavagemId,
        openNovaLavagem,
        closeNovaLavagem,

        novoClienteOpen,
        selectedClienteId,
        openNovoCliente,
        closeNovoCliente,

        novoVeiculoOpen,
        selectedVeiculoId,
        selectedClienteForVeiculoId,
        openNovoVeiculo,
        closeNovoVeiculo,

        novoServicoOpen,
        selectedServicoId,
        openNovoServico,
        closeNovoServico,

        movimentacaoEstoqueOpen,
        selectedProdutoId,
        openMovimentacaoEstoque,
        closeMovimentacaoEstoque,
      }}
    >
      {children}

      <NovaLavagemModal
        isOpen={novaLavagemOpen}
        onClose={closeNovaLavagem}
        lavagemId={selectedLavagemId}
      />

      <NovoClienteModal
        isOpen={novoClienteOpen}
        onClose={closeNovoCliente}
        clienteId={selectedClienteId}
      />

      <NovoVeiculoModal
        isOpen={novoVeiculoOpen}
        onClose={closeNovoVeiculo}
        clienteId={selectedClienteForVeiculoId}
        veiculoId={selectedVeiculoId}
      />

      <NovoServicoModal
        isOpen={novoServicoOpen}
        onClose={closeNovoServico}
        servicoId={selectedServicoId}
      />

      <MovimentacaoEstoqueModal
        isOpen={movimentacaoEstoqueOpen}
        onClose={closeMovimentacaoEstoque}
        produtoId={selectedProdutoId}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
