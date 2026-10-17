import { useRef, useState } from 'react';
import { Camera, Images } from 'lucide-react';
import { analyzeFoodImage } from '../lib/api';
import { fileToResizedBase64 } from '../lib/image';
import { analyseBatch, batchNotice, MAX_PHOTOS_PER_BATCH } from '../lib/photoBatch';
import type { FoodDraft } from '../types';

interface PhotoTabProps {
  /** One draft per photo that was analysed, plus a note about any that weren't. */
  onResults: (drafts: FoodDraft[], notice?: string) => void;
}

export function PhotoTab({ onResults }: PhotoTabProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState('');

  const handleFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    setError(null);
    setProgress({ current: 1, total: Math.min(files.length, MAX_PHOTOS_PER_BATCH) });
    // The context note applies to every photo in the pick.
    const note = context.trim() || undefined;
    const result = await analyseBatch(
      files,
      async (file) => {
        const { base64, mediaType } = await fileToResizedBase64(file);
        return analyzeFoodImage(base64, mediaType, note);
      },
      (current, total) => setProgress({ current, total })
    );
    setProgress(null);
    const notice = batchNotice(result);
    if (result.drafts.length > 0) {
      onResults(result.drafts, notice ?? undefined);
    } else {
      setError(
        result.stoppedBy ??
          (files.length > 1 ? 'None of the photos could be analysed — try others or use Search.' : 'Analysis failed — try another photo or use Search.')
      );
    }
  };

  if (progress) {
    return (
      <div className="analysing">
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
        <p className="body-text">
          {progress.total > 1 ? `Analysing photo ${progress.current} of ${progress.total}…` : 'Analysing your food…'}
        </p>
      </div>
    );
  }

  return (
    <div className="photo-tab">
      <div className="field">
        <label className="field-label">Context for the AI (optional)</label>
        <textarea
          className="input textarea"
          rows={2}
          maxLength={300}
          placeholder='e.g. "grilled, no oil", "half portion", "protein shake with whole milk"'
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>
      <button className="photo-capture" onClick={() => cameraInputRef.current?.click()} type="button">
        <Camera size={32} strokeWidth={1.5} />
        <span>Take photo</span>
      </button>
      <button
        className="btn btn-secondary btn-block"
        onClick={() => libraryInputRef.current?.click()}
        type="button"
      >
        <Images size={16} />
        Choose from library
      </button>
      {error && <p className="caption error-text">{error}</p>}
      <p className="caption muted center">
        Snap your plate and the AI will estimate calories and macros. Pick up to {MAX_PHOTOS_PER_BATCH} photos
        from your library to log several foods at once — you review each before it's added.
      </p>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
