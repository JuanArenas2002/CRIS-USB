import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { EmptyState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';

export function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentMetadata({
    title: t('notFound.title'),
    description: t('notFound.description'),
    path: '/404',
    noindex: true,
  });
  return (
    <div className="container-page py-16">
      <h1 className="sr-only">{t('notFound.title')}</h1>
      <EmptyState
        title={t('notFound.heading')}
        action={
          <Link to="/" className={feedbackButtonClass}>
            {t('notFound.action')}
          </Link>
        }
      >
        {t('notFound.body')}
      </EmptyState>
    </div>
  );
}
