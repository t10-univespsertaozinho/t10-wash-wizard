import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConcluirLavagemDialog } from '@/components/modals/ConcluirLavagemDialog';

describe('ConcluirLavagemDialog', () => {
  it('exige selecionar uma forma e envia o pagamento antes de concluir', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();
    render(<ConcluirLavagemDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    const confirmButton = screen.getByRole('button', { name: 'Confirmar conclusão' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Forma de pagamento' }), {
      target: { value: 'PIX' },
    });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('PIX'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
