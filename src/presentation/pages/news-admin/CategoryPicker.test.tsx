import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryPicker } from './CategoryPicker';

const CATEGORIES = [
  { id: 1, name: 'Investigación' },
  { id: 2, name: 'Innovación' },
  ...Array.from({ length: 98 }, (_, i) => ({ id: i + 3, name: `Sección ${i + 3}` })),
];

function Demo() {
  const [value, setValue] = useState({ principal: 0, extras: [] as number[] });
  return (
    <>
      <CategoryPicker
        categories={CATEGORIES}
        principal={value.principal}
        extras={value.extras}
        onChange={(principal, extras) => setValue({ principal, extras })}
      />
      <output>{JSON.stringify(value)}</output>
    </>
  );
}

test('con 100 categorías: busca (sin tildes), sugiere pocas, la primera es la principal y respeta el máximo', async () => {
  const user = userEvent.setup();
  render(<Demo />);
  const box = screen.getByRole('combobox', { name: /^Categorías/ });

  await user.click(box);
  expect(screen.getAllByRole('option')).toHaveLength(8); // nunca las 100
  expect(screen.getByText('92 más: sigue escribiendo para afinar.')).toBeInTheDocument();

  await user.type(box, 'investigacion'); // sin tilde
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Investigación']);
  await user.keyboard('{Enter}');
  await user.type(box, 'innov');
  await user.click(screen.getByRole('option', { name: 'Innovación' }));
  expect(screen.getByText('{"principal":1,"extras":[2]}')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Hacer principal: Innovación' }));
  expect(screen.getByText('{"principal":2,"extras":[1]}')).toBeInTheDocument();
  const chips = within(screen.getByRole('list', { name: 'Categorías elegidas' })).getAllByRole('listitem');
  expect(chips[0]).toHaveTextContent('InnovaciónPrincipal');

  for (const n of [3, 4, 5]) {
    await user.type(box, `Sección ${n}`);
    await user.click(screen.getByRole('option', { name: `Sección ${n}` }));
  }
  expect(box).toBeDisabled(); // 5 = máximo del backend
  await user.click(screen.getByRole('button', { name: 'Quitar Innovación' }));
  expect(screen.getByText('{"principal":1,"extras":[3,4,5]}')).toBeInTheDocument(); // la siguiente pasa a principal
  expect(box).toBeEnabled();
});
