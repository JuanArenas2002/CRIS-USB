import { Link } from 'react-router';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { EmptyState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';

export function NotFoundPage() {
  useDocumentMetadata({
    title: 'Página no encontrada',
    description: 'La página que buscas no existe o ya no está disponible.',
    path: '/404',
    noindex: true,
  });
  return (
    <div className="container-page py-16">
      <h1 className="sr-only">Página no encontrada</h1>
      <EmptyState
        title="No encontramos esta página"
        action={
          <Link to="/" className={feedbackButtonClass}>
            Ir al directorio de investigadores
          </Link>
        }
      >
        Puede que el enlace esté desactualizado o que el perfil ya no sea público.
      </EmptyState>
    </div>
  );
}
