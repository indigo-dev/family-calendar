import { useEffect, useState } from 'react';
import { thumbUrl, useFrameSettings, usePhotos, type Photo } from '../../lib/frame';
import { Empty, stop, useDash, type WidgetProps } from './shared';
import { t } from '../../i18n';

function useFullUrl(photo: Photo | undefined, enabled: boolean): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!photo || !enabled) return;
    const u = URL.createObjectURL(photo.full);
    // the URL is an external resource: created here, freed in the cleanup
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo, enabled]);
  return photo && enabled ? url : undefined;
}

export function PhotosWidget({ size }: WidgetProps) {
  const { startFrame, openModule } = useDash();
  const photos = usePhotos();
  const cfg = useFrameSettings();
  const selected = (photos ?? []).filter((p) => cfg.selected.includes(p.id));
  const pool = selected.length ? selected : (photos ?? []);
  const [i, setI] = useState(() => Math.floor(Math.random() * 1000));
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  const photo = pool.length ? pool[i % pool.length] : undefined;
  const full = useFullUrl(photo, size === 'l' || size === 'xl');

  if (photos === null) return <Empty>{t('dashboard.loading')}</Empty>;
  if (!photo)
    return (
      <Empty action={t('dashboard.addPhotos')} onAction={() => openModule('frame')}>
        {t('dashboard.noPhotos')}
      </Empty>
    );
  return (
    <div
      className="dw-photo"
      onClick={(e) => {
        if (!selected.length) return; // no slideshow selection: the tap opens the module
        stop(e);
        startFrame(photo.id);
      }}
    >
      <img key={photo.id} src={full ?? thumbUrl(photo)} alt="" draggable={false} />
      {selected.length > 0 && <span className="dw-photo-play">{t('dashboard.slideshow')}</span>}
    </div>
  );
}
