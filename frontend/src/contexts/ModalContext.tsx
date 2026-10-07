import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { NovaLavagemModal } from '@/components/modals/NovaLavagemModal';
import { NovoClienteModal } from '@/components/modals/NovoClienteModal';

interface ModalContextType {
  novaLavagemOpen: boolean;
  novoClienteOpen: boolean;
  openNovaLavagem: () => void;
  closeNovaLavagem: () => void;
  openNovoCliente: () => void;
  closeNovoCliente: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [novaLavagemOpen, setNovaLavagemOpen] = useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const closeNovaLavagem = useCallback(() => setNovaLavagemOpen(false), []);
  const closeNovoCliente = useCallback(() => setNovoClienteOpen(false), []);

  return (
    <ModalContext.Provider
      value={{
        novaLavagemOpen,
        novoClienteOpen,
        openNovaLavagem: () => setNovaLavagemOpen(true),
        closeNovaLavagem,
        openNovoCliente: () => setNovoClienteOpen(true),
        closeNovoCliente,
      }}
    >
      {children}
      <NovaLavagemModal isOpen={novaLavagemOpen} onClose={closeNovaLavagem} />
      <NovoClienteModal isOpen={novoClienteOpen} onClose={closeNovoCliente} />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}