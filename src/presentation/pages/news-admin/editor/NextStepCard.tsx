import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { newsApi, type News } from '@/infrastructure/news/news-api';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
import { Icon } from '@/presentation/components/ui/Icon';
import { Button, Card, Field, Input, StatusLine, TextArea, fromLocalInput, type useAction } from '../ui';
import { isBlocked, isExpired, stageOf, stageText } from './next-step-model';

type Can = (code: string) => boolean;
type Act = (run: () => Promise<unknown>, ok: string) => void;

interface Props {
  news?: News;
  can: Can;
  dirty: boolean;
  todo: string[];
  busy: boolean;
  persist: (ok: string) => Promise<News | undefined>;
  status: Parameters<typeof StatusLine>[0]['status'];
  flow: ReturnType<typeof useAction>;
}

/** «Qué sigue»: la acción que toca según la etapa de la noticia y los permisos de quien la edita. */
export function NextStepCard({ news, can, dirty, todo, busy, persist, status, flow: a }: Props) {
  const [confirm, dialog] = useConfirm();
  const working = busy || a.busy;
  const blocked = isBlocked(todo, news);
  const act: Act = (run, ok) => void a.run(run, ok);

  const actions = (): ReactNode => {
    switch (stageOf(news)) {
      case 'draft':
        return (
          <DraftActions
            news={news}
            can={can}
            dirty={dirty}
            working={working}
            blocked={blocked}
            persist={persist}
            act={act}
          />
        );
      case 'in_review':
        return <ReviewActions news={news!} can={can} working={working} act={act} />;
      case 'approved':
        return can('news.publish') && <PublishActions news={news!} working={working} act={act} />;
      case 'live':
        return (
          <LiveActions
            news={news!}
            can={can}
            dirty={dirty}
            working={working}
            persist={persist}
            act={act}
            confirm={confirm}
          />
        );
      case 'archived':
        return null;
    }
  };
  const content = actions();

  return (
    <Card title="Qué sigue">
      {dialog}
      <p className="text-body-sm text-on-surface">{stageText(news, can)}</p>
      {blocked && (
        <p className="mt-2 text-label-sm text-neutral-muted">Para guardar falta: {todo.join(', ')}.</p>
      )}
      {content && <div className="mt-4 flex flex-wrap gap-2">{content}</div>}
      <div className="mt-3 flex flex-col gap-1">
        <StatusLine status={status} />
        <StatusLine status={a.status} />
      </div>
      {news && (
        <p className="mt-3 border-t border-border-subtle pt-3 text-label-sm text-neutral-muted">
          Cada paso exige el permiso correspondiente sobre todas las dependencias de la noticia.
        </p>
      )}
    </Card>
  );
}

interface DraftProps {
  news?: News;
  can: Can;
  dirty: boolean;
  working: boolean;
  blocked: boolean;
  persist: Props['persist'];
  act: Act;
}

function DraftActions({ news, can, dirty, working, blocked, persist, act }: DraftProps) {
  return (
    <>
      {can('news.submit') && news && (
        <Button
          variant="primary"
          disabled={working || blocked}
          onClick={async () => {
            const saved = await persist('Cambios guardados.');
            if (saved)
              act(
                () => newsApi.action(saved.id, 'submit'),
                'Enviada a revisión. Un revisor la aprobará o pedirá cambios.',
              );
          }}
        >
          {dirty ? 'Guardar y enviar a revisión' : 'Enviar a revisión'}
        </Button>
      )}
      <Button
        variant={news ? 'secondary' : 'primary'}
        disabled={working || blocked || (!!news && !dirty)}
        onClick={() => void persist(news ? 'Borrador guardado.' : 'Borrador creado.')}
      >
        {news ? 'Guardar borrador' : 'Crear borrador'}
      </Button>
    </>
  );
}

function ReviewActions({ news, can, working, act }: { news: News; can: Can; working: boolean; act: Act }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  if (rejecting)
    return (
      <div className="flex w-full flex-col gap-2">
        <Field label="¿Qué debe corregirse?">
          <TextArea value={reason} autoFocus onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button
            variant="danger"
            disabled={working || reason.trim().length < 5}
            onClick={() =>
              act(() => newsApi.reject(news.id, reason.trim()), 'Devuelta al autor con tus comentarios.')
            }
          >
            Confirmar
          </Button>
          <Button onClick={() => setRejecting(false)}>Cancelar</Button>
        </div>
      </div>
    );
  return (
    <>
      {can('news.approve') && (
        <Button
          variant="primary"
          disabled={working}
          onClick={() => act(() => newsApi.action(news.id, 'approve'), 'Aprobada: lista para publicar.')}
        >
          Aprobar
        </Button>
      )}
      {can('news.review') && (
        <Button disabled={working} onClick={() => setRejecting(true)}>
          Pedir cambios
        </Button>
      )}
    </>
  );
}

function PublishActions({ news, working, act }: { news: News; working: boolean; act: Act }) {
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState('');
  if (scheduling)
    return (
      <div className="flex w-full flex-col gap-2">
        <Field label="Publicar el">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={working || !when}
            onClick={() =>
              act(
                () => newsApi.schedule(news.id, fromLocalInput(when)!),
                'Programada: aparecerá sola en esa fecha.',
              )
            }
          >
            Programar
          </Button>
          <Button onClick={() => setScheduling(false)}>Cancelar</Button>
        </div>
      </div>
    );
  return (
    <>
      <Button
        variant="primary"
        disabled={working}
        onClick={() => act(() => newsApi.action(news.id, 'publish'), 'Publicada en el portal.')}
      >
        Publicar ahora
      </Button>
      <Button disabled={working} onClick={() => setScheduling(true)}>
        Programar…
      </Button>
    </>
  );
}

interface LiveProps {
  news: News;
  can: Can;
  dirty: boolean;
  working: boolean;
  persist: Props['persist'];
  act: Act;
  confirm: ReturnType<typeof useConfirm>[0];
}

/** Programada o publicada: ver en el portal, curar (guardar cambios) y archivar. */
function LiveActions({ news, can, dirty, working, persist, act, confirm }: LiveProps) {
  return (
    <>
      {news.status === 'published' && !isExpired(news) && (
        <Link
          to={`/noticias/${news.slug}`}
          target="_blank"
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-border-subtle px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt"
        >
          Ver en el portal <Icon name="open_in_new" className="text-[16px]" />
        </Link>
      )}
      {can('news.curate') && dirty && (
        <Button variant="primary" disabled={working} onClick={() => void persist('Cambios guardados.')}>
          Guardar cambios
        </Button>
      )}
      {can('news.archive') && (
        <Button
          variant="danger"
          disabled={working}
          onClick={async () => {
            if (
              await confirm(
                '¿Archivar la noticia? Dejará de mostrarse en el portal (se conserva su historial).',
                'Archivar',
              )
            )
              act(() => newsApi.archive(news.id), 'Archivada.');
          }}
        >
          Archivar
        </Button>
      )}
    </>
  );
}
