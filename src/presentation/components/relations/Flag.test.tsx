import { render } from '@testing-library/react';
import { Flag } from './Flag';

// Los países que una subdivisión con el mismo sufijo pisaba (BQ-BO, GB-NIR, GB-WLS, GB-ENG, BQ-SA, BQ-SE).
test.each(['BO', 'IR', 'LS', 'NG', 'SA', 'SE', 'CO', 'ES'])(
  'bandera de %s: su propio archivo, nunca el de una subdivisión',
  (iso2) => {
    const { container } = render(<Flag iso2={iso2} />);
    const src = container.querySelector('img')?.getAttribute('src') ?? '';
    expect(src).toMatch(new RegExp(`/${iso2}[.]svg`));
    expect(src).not.toMatch(/[A-Z]{2}-[A-Z]+\.svg/);
  },
);
