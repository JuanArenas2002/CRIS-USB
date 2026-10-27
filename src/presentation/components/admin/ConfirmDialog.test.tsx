import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { useConfirm } from './ConfirmDialog';

function Demo({ onDelete }: { onDelete: () => void }) {
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <button type="button" onClick={async () => (await confirm('¿Quitar la foto?')) && onDelete()}>
        Quitar foto
      </button>
    </>
  );
}

test('confirmación propia: cancelar no ejecuta la acción; confirmar sí (sin window.confirm)', async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  const native = vi.spyOn(window, 'confirm');
  render(<Demo onDelete={onDelete} />);

  await user.click(screen.getByRole('button', { name: 'Quitar foto' }));
  expect(screen.getByText('¿Quitar la foto?')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cancelar', hidden: true }));
  expect(onDelete).not.toHaveBeenCalled();
  expect(screen.queryByText('¿Quitar la foto?')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Quitar foto' }));
  await user.click(screen.getByRole('button', { name: 'Quitar', hidden: true }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(native).not.toHaveBeenCalled();
});
