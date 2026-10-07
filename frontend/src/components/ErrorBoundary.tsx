import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback alternativo; por padrão usa a tela de recuperação abaixo. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Sem um ErrorBoundary, qualquer exceção lançada durante o render desmonta a
 * árvore inteira e o usuário fica com uma tela branca — sem mensagem, sem botão
 * e (com `hmr.overlay: false` no Vite) sem nem o overlay de desenvolvimento
 * avisando o que aconteceu (FA-10).
 *
 * Só captura erros de render/lifecycle do React. Rejeições de promessa em
 * handlers assíncronos continuam sendo responsabilidade de cada chamada
 * (try/catch + toast), porque o React não as entrega ao boundary.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro de renderização capturado pelo ErrorBoundary:', error, info.componentStack);
  }

  private recarregar = () => {
    window.location.reload();
  };

  // Tenta remontar a árvore sem recarregar a página: resolve o caso em que o
  // erro vinha de um dado transitório já corrigido no servidor.
  private tentarNovamente = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <main
        id="main-content"
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        className="min-h-screen flex items-center justify-center bg-background p-4 focus:outline-none"
      >
        <div className="w-full max-w-md bg-card rounded-xl border border-border p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-barlow-condensed font-bold text-foreground">
            Algo deu errado nesta tela
          </h1>
          <p className="text-sm text-muted-foreground">
            A página não pôde ser exibida, mas seus dados continuam salvos no servidor.
            Tente novamente ou recarregue o sistema.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-left text-sm bg-secondary/60 text-muted-foreground rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {error.message}
            </pre>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button
              type="button"
              onClick={this.tentarNovamente}
              className="bg-primary text-primary-foreground font-bold py-2.5 px-5 rounded-lg hover:brightness-110 transition-all text-sm"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.recarregar}
              className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-semibold py-2.5 px-5 rounded-lg hover:bg-secondary/60 transition-colors text-sm"
            >
              <RefreshCw size={14} aria-hidden="true" /> Recarregar sistema
            </button>
          </div>
        </div>
      </main>
    );
  }
}
