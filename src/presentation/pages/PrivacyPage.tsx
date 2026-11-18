import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { activeLocale } from '@/i18n';
import { openPreferences } from '@/infrastructure/privacy/consent';
import { POLICY_KINDS, privacyApi, type PolicyKind } from '@/infrastructure/privacy/privacy-api';
import { ARTICLE_PROSE } from '@/presentation/components/news/article-prose';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';

/**
 * /privacidad: las tres políticas vigentes y el historial de versiones publicadas (trazabilidad).
 * `?documento=cookie_policy&version=1`. El HTML llega saneado por el backend (nh3).
 */
export function PrivacyPage() {
  const { t } = useTranslation('privacy');
  useDocumentMetadata({ title: t('page.title'), description: t('page.description'), path: '/privacidad' });
  const [params, setParams] = useSearchParams();
  const kind = (POLICY_KINDS as readonly string[]).includes(params.get('documento') ?? '')
    ? (params.get('documento') as PolicyKind)
    : 'privacy_policy';
  const current = useQuery({ queryKey: ['privacy', 'policies'], queryFn: privacyApi.policies });
  const entry = current.data?.find((p) => p.kind === kind);
  const version = Number(params.get('version')) || entry?.version;
  const old = useQuery({
    queryKey: ['privacy', 'policy', kind, version],
    queryFn: () => privacyApi.policy(kind, version!),
    enabled: !!entry && version !== entry.version,
  });
  const doc = entry && version !== entry.version ? old.data : entry;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(activeLocale(), { dateStyle: 'long' });

  return (
    <div className="w-full bg-surface-container-lowest">
      <div className="container-page py-10">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-headline-lg font-extrabold tracking-tight text-on-surface">
              {t('page.title')}
            </h1>
            <button
              type="button"
              onClick={openPreferences}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-label-md font-semibold text-on-primary hover:bg-secondary"
            >
              {t('page.configure')}
            </button>
          </header>
          <nav aria-label={t('page.title')} className="flex flex-wrap gap-2">
            {POLICY_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-current={k === kind ? 'page' : undefined}
                onClick={() => setParams({ documento: k })}
                className={`min-h-11 rounded-full border px-4 text-label-md font-semibold ${
                  k === kind
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-subtle text-on-surface hover:bg-surface-cream-alt'
                }`}
              >
                {t(`links.${k}`)}
              </button>
            ))}
          </nav>
          {current.isPending || (old.isFetching && !doc) ? (
            <p role="status" className="text-body-md text-neutral-muted">
              …
            </p>
          ) : current.isError || !doc ? (
            <p role="alert" className="text-body-md text-error">
              {t('page.error')}
            </p>
          ) : (
            <article className="flex flex-col gap-4">
              <div>
                <h2 className="text-title-lg font-bold text-on-surface">{doc.title}</h2>
                <p className="mt-1 text-label-md text-neutral-muted">
                  {t('page.version', { version: doc.version, date: fmt(doc.effective_at) })}
                </p>
                <p className="mt-3 text-body-md text-on-surface-variant">{doc.summary}</p>
              </div>
              <div className={ARTICLE_PROSE} dangerouslySetInnerHTML={{ __html: doc.content }} />
              {entry && entry.versions.length > 1 && (
                <section className="border-t border-border-subtle pt-4">
                  <h3 className="mb-2 text-label-md font-bold text-on-surface">{t('page.history')}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {entry.versions.map((v) => (
                      <li key={v.version}>
                        <button
                          type="button"
                          aria-current={v.version === doc.version ? 'true' : undefined}
                          onClick={() => setParams({ documento: kind, version: String(v.version) })}
                          className="rounded-lg border border-border-subtle px-3 py-1.5 text-label-md hover:bg-surface-cream-alt aria-[current=true]:border-secondary aria-[current=true]:font-bold"
                        >
                          v{v.version} · {fmt(v.effective_at)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
