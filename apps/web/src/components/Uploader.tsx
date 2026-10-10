import { Camera, FileUp, LoaderCircle, Sparkles } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './ui/button';

export function Uploader({ title, hint, busyText, onFile, onSample, sampleLabel, disabled, error }: { title: string; hint: string; busyText: string | null; onFile: (f: File) => void; onSample?: () => void; sampleLabel?: string; disabled?: boolean; error?: ReactNode }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = busyText !== null;

  const pick = (list: FileList | null) => {
    const f = list?.[0];
    if (f) onFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!busy && !disabled) pick(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn('rounded-[1.5rem] border-2 border-dashed bg-surface p-6 text-center transition-colors sm:p-8', over ? 'border-primary bg-primary-soft' : 'border-line')}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3 py-6" role="status" aria-live="polite">
            <LoaderCircle className="size-9 animate-spin text-primary" aria-hidden />
            <p className="text-lg font-semibold">{busyText}</p>
            <p className="text-sm text-muted">This usually takes a few seconds.</p>
          </div>
        ) : (
          <>
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <FileUp className="size-7" aria-hidden />
            </div>
            <h2 className="mt-4 font-display text-2xl">{title}</h2>
            <p className="mx-auto mt-1 max-w-sm text-[15px] text-muted">{hint}</p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => fileRef.current?.click()} disabled={disabled}>
                <FileUp className="size-5" aria-hidden /> Choose a file
              </Button>
              <Button size="lg" variant="secondary" onClick={() => camRef.current?.click()} disabled={disabled}>
                <Camera className="size-5" aria-hidden /> Take a photo
              </Button>
            </div>
            {onSample && (
              <button type="button" onClick={onSample} disabled={disabled} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-primary hover:bg-primary-soft disabled:opacity-50">
                <Sparkles className="size-4" aria-hidden /> {sampleLabel ?? 'Try the sample'}
              </button>
            )}
          </>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" tabIndex={-1} aria-label={title} onChange={(e) => { pick(e.target.files); e.target.value = ''; }} data-testid="file-input" />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Take a photo" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <div className="mt-4">{error}</div>}
    </div>
  );
}
