import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { blankManualDraft, lookupBarcode } from '../lib/api';
import type { FoodDraft } from '../types';

type ScanState = 'starting' | 'scanning' | 'looking' | 'notfound' | 'denied';

interface ScanTabProps {
  onResult: (draft: FoodDraft) => void;
  onSwitchToPhoto: () => void;
}

export function ScanTab({ onResult, onSwitchToPhoto }: ScanTabProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [state, setState] = useState<ScanState>('starting');
  const [restartKey, setRestartKey] = useState(0);
  const [manualCode, setManualCode] = useState('');

  const handleCode = async (raw: string) => {
    const code = raw.replace(/\D/g, '');
    if (code.length < 8 || handledRef.current) return;
    handledRef.current = true;
    controlsRef.current?.stop();
    setState('looking');
    try {
      const result = await lookupBarcode(code);
      if (result.found) {
        onResult(result.draft);
      } else {
        setState('notfound');
        handledRef.current = false;
      }
    } catch {
      setState('notfound');
      handledRef.current = false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current!,
          (result) => {
            if (result) handleCode(result.getText());
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState('scanning');
      } catch {
        if (!cancelled) setState('denied');
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.replace(/\D/g, '').length >= 8) handleCode(manualCode);
  };

  if (state === 'denied') {
    return (
      <div className="scan-fallback">
        <p className="body-text">Camera access was denied.</p>
        <p className="caption muted">
          Allow camera access in your browser settings to scan barcodes, or enter the barcode number
          below.
        </p>
        <form className="manual-row" onSubmit={submitManual}>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Barcode number"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">
            Look up
          </button>
        </form>
        <button className="btn btn-secondary btn-block" onClick={onSwitchToPhoto} type="button">
          Use Photo instead
        </button>
        <button
          className="btn btn-secondary btn-block"
          onClick={() => onResult(blankManualDraft())}
          type="button"
        >
          Enter manually
        </button>
      </div>
    );
  }

  if (state === 'notfound') {
    return (
      <div className="scan-fallback">
        <p className="body-text">Product not found</p>
        <p className="caption muted">Enter its details by hand, or try another method.</p>
        <button className="btn btn-primary btn-block" onClick={() => onResult(blankManualDraft())} type="button">
          Enter manually
        </button>
        <button className="btn btn-secondary btn-block" onClick={onSwitchToPhoto} type="button">
          Switch to Photo
        </button>
        <button
          className="btn btn-secondary btn-block"
          onClick={() => {
            setState('starting');
            setRestartKey((k) => k + 1);
          }}
          type="button"
        >
          Scan again
        </button>
      </div>
    );
  }

  return (
    <div className="scan-tab">
      <div className="scanner-view">
        <video ref={videoRef} muted playsInline />
        <div className="scan-overlay">
          <div className="scan-frame" />
          <div className="scan-line" />
        </div>
      </div>
      <p className="scanner-status caption">
        {state === 'starting' && 'Starting camera…'}
        {state === 'scanning' && 'Point at a barcode (EAN-13, UPC-A or QR)'}
        {state === 'looking' && 'Looking up product…'}
      </p>
      <form className="manual-row" onSubmit={submitManual}>
        <input
          className="input"
          inputMode="numeric"
          placeholder="Or type barcode number"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button className="btn btn-secondary" type="submit">
          Look up
        </button>
      </form>
    </div>
  );
}
