/**
 * ErrorBoundary (FA-10).
 *
 * A falha original era a tela branca: uma exceção de render desmontava a árvore
 * inteira, sem mensagem e sem caminho de volta. O teste reproduz isso com um
 * componente que lança no render e verifica que sobra UI utilizável.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';

function ComponenteQueQuebra({ quebrar }: { quebrar: boolean }) {
  if (quebrar) throw new Error('Falha simulada no render');
  return <p>conteúdo normal</p>;
}

/**
 * Quebra enquanto o sinalizador estiver ligado. Um componente que "quebra só na
 * primeira vez" não serve: ao capturar um erro o React tenta renderizar de novo
 * antes de desistir, e a segunda tentativa já passaria.
 */
let deveQuebrar = true;
function ComponenteControlado() {
  if (deveQuebrar) throw new Error('Falha transitória');
  return <p>recuperado</p>;
}

beforeEach(() => {
  // O React loga o erro capturado no console; silenciar mantém a saída da suíte
  // legível sem esconder falhas reais dos testes.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renderiza os filhos quando nada falha', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('conteúdo normal')).toBeInTheDocument();
  });

  it('mostra a tela de recuperação em vez de desmontar tudo', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Algo deu errado nesta tela/i)).toBeInTheDocument();
    expect(screen.queryByText('conteúdo normal')).not.toBeInTheDocument();
  });

  it('oferece caminhos de saída ao usuário', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recarregar sistema/i })).toBeInTheDocument();
  });

  it('registra o erro no console para o diagnóstico', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('"Tentar novamente" remonta a árvore sem recarregar a página', () => {
    deveQuebrar = true;

    render(
      <ErrorBoundary>
        <ComponenteControlado />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // A causa foi corrigida no servidor: remontar agora tem que funcionar.
    deveQuebrar = false;
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    expect(screen.getByText('recuperado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Recarregar sistema" recarrega a página', () => {
    const recarregar = vi.fn();
    // jsdom não implementa reload; substituir a propriedade é a forma suportada.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: recarregar },
    });

    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /Recarregar sistema/i }));

    expect(recarregar).toHaveBeenCalledOnce();
  });

  it('mostra a mensagem técnica do erro em desenvolvimento', () => {
    // import.meta.env.DEV é true sob o Vitest, então o bloco de diagnóstico
    // aparece — é o que ajuda o dev a achar a causa sem abrir o console.
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar />
      </ErrorBoundary>
    );

    expect(screen.getByText('Falha simulada no render')).toBeInTheDocument();
  });

  it('respeita um fallback customizado', () => {
    render(
      <ErrorBoundary fallback={<p>fallback do chamador</p>}>
        <ComponenteQueQuebra quebrar />
      </ErrorBoundary>
    );

    expect(screen.getByText('fallback do chamador')).toBeInTheDocument();
  });
});
