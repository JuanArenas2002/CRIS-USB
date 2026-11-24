// Marco y objetivos (textos libres de Metri-K, traducidos en el navegador) con los ODS en una columna a la derecha.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '@/domain/projects/project';
import { OdsIcon } from '@/presentation/components/groups/OdsIcons';
import { AutoTranslateNote, TextSkeleton, sourceLang } from '@/presentation/components/ui/AutoTranslate';
import { Icon } from '@/presentation/components/ui/Icon';
import { useAutoTranslate } from '@/presentation/hooks/use-auto-translate';
import { proseTexts } from './project-model';
import { Linkified, SectionTitle, card } from './ProjectParts';

const H3 = 'mb-1.5 flex items-center gap-2 text-label-md font-bold tracking-wider text-secondary uppercase';

/** Problema, solución y beneficiarios: índice en los textos traducibles, campo y icono. */
const BLOCKS = [
  [1, 'problem', 'flag'],
  [2, 'solution', 'lightbulb'],
  [3, 'beneficiaries', 'groups'],
] as const;

export function ProjectFramework({ project: p }: { project: Project }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  const prose = proseTexts(p);
  const tr = useAutoTranslate(prose);
  const proseOf = (i: number): ReactNode =>
    tr.status === 'pending' ? (
      <TextSkeleton lines={3} />
    ) : (
      <span lang={sourceLang(tr.status)}>{tr.texts[i]}</span>
    );
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className={`${card} flex flex-col gap-5 p-5 md:p-8`}>
        <SectionTitle>{t('detail.framework')}</SectionTitle>
        {prose.some(Boolean) ? <AutoTranslateNote status={tr.status} onRetry={tr.retry} /> : null}
        {p.objective ? (
          <div className="rounded-xl border-l-4 border-secondary bg-badge-sage-bg/60 p-5 md:p-6">
            <h3 className="mb-1 flex items-center gap-2 text-label-md font-bold tracking-widest text-badge-sage-text uppercase">
              <Icon name="format_quote" className="text-[24px]" /> {t('detail.objective')}
            </h3>
            <p className="text-body-lg leading-relaxed text-on-surface">{proseOf(0)}</p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BLOCKS.map(([i, key, icon]) =>
            prose[i] ? (
              <div key={key} className="rounded-xl bg-canvas-cream p-4">
                <h3 className={H3}>
                  <Icon name={icon} className="text-[18px]" /> {t(`detail.${key}`)}
                </h3>
                <p className="text-body-sm whitespace-pre-line text-on-surface-variant">{proseOf(i)}</p>
              </div>
            ) : null,
          )}
        </div>
        {p.results ? (
          <div>
            <h3 className={H3}>
              <Icon name="emoji_events" className="text-[18px]" /> {t('detail.results')}
            </h3>
            <p className="text-body-sm whitespace-pre-line text-on-surface-variant">{proseOf(4)}</p>
          </div>
        ) : null}
        {p.evidence ? (
          <div>
            <h3 className={H3}>
              <Icon name="verified" className="text-[18px]" /> {t('detail.evidence')}
            </h3>
            <p className="text-body-sm whitespace-pre-line text-on-surface-variant">
              <Linkified text={p.evidence} />
            </p>
          </div>
        ) : null}
      </section>
      <ProjectOds ods={p.ods} />
    </div>
  );
}

function ProjectOds({ ods }: { ods: Project['ods'] }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  return (
    <aside className={`${card} flex flex-col gap-4 p-5 lg:sticky lg:top-24`}>
      <div>
        <h2 className="text-headline-sm font-semibold text-primary">{t('detail.ods')}</h2>
        <p className="text-body-sm text-on-surface-variant">{t('detail.odsLead')}</p>
      </div>
      {ods.length ? (
        <ul className="flex flex-col gap-3">
          {ods.map((id) => (
            <li key={id} className="flex items-center gap-3">
              <OdsIcon id={id} size={48} />
              <span className="text-body-sm leading-tight font-semibold text-primary">
                {t(`groups:ods.names.goal${id}.name`)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-neutral-muted">{t('detail.noOds')}</p>
      )}
    </aside>
  );
}
