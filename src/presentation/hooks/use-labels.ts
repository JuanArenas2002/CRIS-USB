import { useTranslation } from 'react-i18next';
import type { AuthorCategoryId, TypologyId } from '@/domain/authors/author';
import { activeLocale } from '@/i18n';

/**
 * Etiquetas de enumeraciones del dominio y formatos regionales en el idioma activo.
 * El dominio guarda ids estables; aquí se convierten en texto.
 */
export function useLabels() {
  const { t } = useTranslation(['authors', 'groups']);
  const domain = t('domainLabels', { returnObjects: true }) as Record<string, string>;
  const term = (s: string) => domain[s] ?? s;
  const number = new Intl.NumberFormat(activeLocale());
  const percent = new Intl.NumberFormat(activeLocale(), { style: 'percent', maximumFractionDigits: 1 });
  const category = (id: AuthorCategoryId) => t(`category.${id}`);
  return {
    category,
    /** "Investigador Sénior" / "Senior Researcher"; sin categoría, "Investigador". */
    researcher: (id: AuthorCategoryId | null) =>
      id ? t('researcherWithCategory', { category: category(id) }) : t('researcher'),
    typology: (id: TypologyId) => t(`typology.${id}.label`),
    typologyShort: (id: TypologyId) => t(`typology.${id}.short`),
    /**
     * Vocabulario controlado (dominio y backend: tipo de producto, formación, tipo de grupo, tipos de
     * Scopus…). Compuestos "Scopus · Article" se traducen por partes; lo desconocido y los nombres
     * propios salen tal cual.
     */
    domain: (s: string) => s.split(' · ').map(term).join(' · '),
    /** "Convocatoria 833 de 2018" → "Call 833 of 2018"; otro formato, tal cual. */
    convocation: (s: string) => {
      const m = /^Convocatoria\s+(\d+)\s+de\s+(\d{4})$/i.exec(s.trim());
      return m ? t('groups:convocation', { number: m[1], year: m[2] }) : s;
    },
    number: (n: number) => number.format(n),
    percent: (n: number) => percent.format(n),
  };
}
