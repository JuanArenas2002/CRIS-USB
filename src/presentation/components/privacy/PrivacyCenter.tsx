import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { activeLocale } from '@/i18n';
import {
  closePreferences,
  loadConsent,
  openPreferences,
  revokeConsent,
  saveConsent,
  useConsent,
  type Category,
  type Method,
} from '@/infrastructure/privacy/consent';
import { POLICY_KINDS, privacyApi, type CookieCategory } from '@/infrastructure/privacy/privacy-api';

/**
 * Aviso inicial + centro de preferencias. Se monta una vez en el layout público.
 * - El aviso NO bloquea la lectura (no es modal) y aparece solo si falta una decisión válida (primera visita,
 *   decisión vencida o cambio sustancial de la política). «Aceptar» y «Rechazar» tienen el mismo peso visual.
 * - El centro de preferencias es un <dialog> nativo: foco atrapado, Esc para cerrar y retorno del foco.
 */
const SAME_WEIGHT =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-label-md font-semibold text-on-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';
const OUTLINE =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

export function PrivacyCenter() {
  const { status, prefs, panelOpen } = useConsent();
  useEffect(() => void loadConsent(), []);
  return (
    <>
      {status === 'ready' && prefs?.needs_decision && !panelOpen && <Banner />}
      {panelOpen && <Preferences />}
    </>
  );
}

function PolicyLinks({ className = '' }: { className?: string }) {
  const { t } = useTranslation('privacy');
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-label-md ${className}`}>
      {POLICY_KINDS.map((k) => (
        <li key={k}>
          <Link
            to={`/privacidad?documento=${k}`}
            onClick={closePreferences}
            className="font-semibold text-secondary underline underline-offset-2 hover:text-primary"
          >
            {t(`links.${k}`)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function useDecide() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { t } = useTranslation('privacy');
  const run = async (action: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: ok });
    } catch {
      setMessage({ ok: false, text: t('panel.error') });
    } finally {
      setBusy(false);
    }
  };
  const decide = (choice: Record<Category, boolean>, method: Method) =>
    run(() => saveConsent(choice, method), t('panel.saved'));
  return { busy, message, decide, revoke: () => run(revokeConsent, t('panel.revoked')) };
}

function Banner() {
  const { t } = useTranslation('privacy');
  const { prefs } = useConsent();
  const { busy, message, decide } = useDecide();
  const updated = !!prefs?.consent; // ya había decidido: la política cambió de forma sustancial o venció
  return (
    <section
      aria-label={t('banner.label')}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border-subtle bg-surface-container-lowest shadow-[0_-8px_24px_rgb(0_0_0/0.08)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-xl sm:rounded-2xl sm:border"
    >
      <div className="flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
        <h2 className="text-title-md font-bold text-on-surface">{t('banner.title')}</h2>
        {updated && (
          <p className="rounded-lg bg-cta-sage px-3 py-2 text-body-sm font-semibold text-primary">
            {t('banner.updated', { version: prefs!.cookie_policy_version })}
          </p>
        )}
        <p className="text-body-sm text-on-surface-variant">{t('banner.body')}</p>
        <PolicyLinks />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={busy}
            className={SAME_WEIGHT}
            onClick={() => void decide({ functional: false, analytics: false }, 'reject_optional')}
          >
            {t('banner.reject')}
          </button>
          <button
            type="button"
            disabled={busy}
            className={SAME_WEIGHT}
            onClick={() => void decide({ functional: true, analytics: true }, 'accept_all')}
          >
            {t('banner.accept')}
          </button>
          <button type="button" disabled={busy} className={OUTLINE} onClick={openPreferences}>
            {t('banner.configure')}
          </button>
        </div>
        {message && !message.ok && (
          <p role="alert" className="text-body-sm text-error">
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}

function Preferences() {
  const { t } = useTranslation('privacy');
  const { prefs } = useConsent();
  const dialog = useRef<HTMLDialogElement>(null);
  const categories = useQuery({ queryKey: ['privacy', 'categories'], queryFn: privacyApi.categories });
  const [choice, setChoice] = useState<Record<Category, boolean>>({
    functional: prefs?.categories.functional ?? false,
    analytics: prefs?.categories.analytics ?? false,
  });
  const { busy, message, decide, revoke } = useDecide();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', ''); // navegadores/entornos sin <dialog> modal
    }
  }, []);

  const consent = prefs?.consent;
  const decidedNow = !prefs?.needs_decision && consent;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="privacy-title"
      onClose={closePreferences}
      onCancel={closePreferences}
      className="m-auto max-h-[92dvh] w-[min(46rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-border-subtle bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-surface-dark-forest/50"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
          <div>
            <h2 id="privacy-title" className="text-title-lg font-bold">
              {t('panel.title')}
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">{t('panel.intro')}</p>
            <p className="mt-2 text-label-md text-neutral-muted">
              {decidedNow
                ? t('panel.current', {
                    date: new Date(consent.decided_at).toLocaleString(activeLocale()),
                    version: consent.policy_version,
                  })
                : t('panel.none')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close?.() ?? closePreferences()}
            aria-label={t('panel.close')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[22px] leading-none hover:bg-surface-cream-alt"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {categories.isPending ? (
            <p role="status" className="text-body-sm text-neutral-muted">
              …
            </p>
          ) : categories.isError ? (
            <p role="alert" className="text-body-sm text-error">
              {t('panel.loadError')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {categories.data.map((c) => (
                <CategoryItem
                  key={c.code}
                  category={c}
                  checked={c.is_required || (!!c.is_available && !!choice[c.code as Category])}
                  onChange={(v) => setChoice((s) => ({ ...s, [c.code]: v }))}
                />
              ))}
            </ul>
          )}
          <PolicyLinks className="mt-4" />
        </div>

        <footer className="flex flex-col gap-2 border-t border-border-subtle p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div aria-live="polite" className="min-h-5 flex-1 text-body-sm">
            {message && (
              <span
                role={message.ok ? 'status' : 'alert'}
                className={message.ok ? 'text-secondary' : 'text-error'}
              >
                {message.text}
              </span>
            )}
          </div>
          {decidedNow && (consent.categories.functional || consent.categories.analytics) && (
            <button type="button" disabled={busy} className={OUTLINE} onClick={() => void revoke()}>
              {t('panel.revoke')}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            className={SAME_WEIGHT}
            onClick={() => void decide({ functional: false, analytics: false }, 'reject_optional')}
          >
            {t('panel.rejectAll')}
          </button>
          <button
            type="button"
            disabled={busy}
            className={SAME_WEIGHT}
            onClick={() => void decide({ functional: true, analytics: true }, 'accept_all')}
          >
            {t('panel.acceptAll')}
          </button>
          <button
            type="button"
            disabled={busy || categories.isPending}
            className={OUTLINE}
            onClick={() => void decide(choice, 'custom')}
          >
            {t('panel.save')}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function CategoryItem({
  category: c,
  checked,
  onChange,
}: {
  category: CookieCategory;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation('privacy');
  const locked = c.is_required || !c.is_available;
  const id = `privacy-${c.code}`;
  return (
    <li className="rounded-xl border border-border-subtle p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="text-body-md font-bold text-on-surface">
            {c.name}
          </label>
          <p id={`${id}-desc`} className="mt-1 text-body-sm text-on-surface-variant">
            {c.description}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {locked && (
            <span className="text-label-sm font-semibold text-neutral-muted">
              {c.is_required ? t('panel.always') : t('panel.notUsed')}
            </span>
          )}
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={checked}
            disabled={locked}
            aria-describedby={`${id}-desc`}
            onChange={(e) => onChange(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            onClick={() => !locked && onChange(!checked)}
            className={`relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-secondary ${
              checked ? 'bg-secondary' : 'bg-outline-variant'
            } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span
              className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                checked ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
        </span>
      </div>
      <details className="mt-3 text-body-sm">
        <summary className="cursor-pointer font-semibold text-secondary">{t('panel.technologies')}</summary>
        <dl className="mt-2 grid gap-1 text-on-surface-variant">
          <div>
            <dt className="inline font-semibold text-on-surface">{t('panel.purpose')}: </dt>
            <dd className="inline">{c.purpose}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-on-surface">{t('panel.retention')}: </dt>
            <dd className="inline">{c.retention}</dd>
          </div>
        </dl>
        {c.technologies.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-label-md">
              <thead className="text-neutral-muted">
                <tr>
                  {(['name', 'type', 'duration', 'provider', 'purpose'] as const).map((k) => (
                    <th key={k} className="py-1 pr-3 font-semibold">
                      {t(`panel.cols.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.technologies.map((x) => (
                  <tr key={x.name} className="border-t border-border-subtle align-top">
                    <td className="py-1.5 pr-3 font-mono text-[0.8rem] break-all">{x.name}</td>
                    <td className="pr-3">{t(`panel.types.${x.type}`, { defaultValue: x.type })}</td>
                    <td className="pr-3">{x.duration}</td>
                    <td className="pr-3">{x.provider}</td>
                    <td>{x.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </li>
  );
}
