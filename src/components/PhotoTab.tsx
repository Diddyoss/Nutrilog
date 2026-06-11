import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { analyzeFoodImage } from '../lib/api';
import { fileToResizedBase64 } from '../lib/image';
import type { FoodDraft } from '../types';

interface PhotoTabProps {
  onResult: (draft: FoodDraft) => void;
}

export function PhotoTab({ onResult }: PhotoTabProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState('');

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { base64, mediaType } = await fileToResizedBase64(file);
      const draft = await analyzeFoodImage(base64, mediaType, context.trim() || undefined);
      onResult(draft);
    } catch {
      setError('Analysis failed — try another photo or use Search.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analysing">
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
        <p className="body-text">Analysing your food…</p>
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
        <ImageIcon size={16} />
        Upload from library
      </button>
      {error && <p className="caption error-text">{error}</p>}
      <p className="caption muted center">
        Snap your plate and the AI will estimate calories and macros. You can adjust everything
        before saving.
      </p>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
