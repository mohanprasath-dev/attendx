'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { recordAttendance } from '@/lib/attendance';
import { getEvent, type EventRecord } from '@/lib/events';

// ─── Types ───────────────────────────────────────────────────────────────────

type Toast = {
  id: string;
  kind: 'success' | 'error' | 'warn';
  message: string;
};

type ScanEntry = {
  id: string;
  name: string;
  round: string;
  time: Date;
  status: 'success' | 'error';
  message: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SCAN_COOLDOWN_MS = 2500; // debounce between scans
const TOAST_TTL_MS = 4500;
const MAX_RECENT_SCANS = 5;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const { eventId } = useParams<{ eventId: string }>();

  // Event data
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // Round selector
  const [selectedRound, setSelectedRound] = useState('');
  const selectedRoundRef = useRef('');

  // Camera / scanner
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const lastScanRef = useRef<number>(0);
  const html5QrRef = useRef<{ isScanning: boolean; stop: () => Promise<void> } | null>(null);

  // UI feedback
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);

  // ─── Keep refs in sync with state ──────────────────────────────────────────
  useEffect(() => {
    selectedRoundRef.current = selectedRound;
  }, [selectedRound]);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  // ─── Toast helpers ──────────────────────────────────────────────────────────
  function addToast(kind: Toast['kind'], message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_TTL_MS);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // ─── Scan history helper ────────────────────────────────────────────────────
  function addScanEntry(entry: Omit<ScanEntry, 'id'>) {
    const id = crypto.randomUUID();
    setRecentScans((prev) => [{ id, ...entry }, ...prev].slice(0, MAX_RECENT_SCANS));
  }

  // ─── Load event ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;

    async function load() {
      try {
        const ev = await getEvent(eventId);

        if (!ev) {
          setEventError('Event not found.');
          return;
        }

        setEvent(ev);
        if (ev.rounds.length > 0) {
          setSelectedRound(ev.rounds[0]);
          selectedRoundRef.current = ev.rounds[0];
        }
      } catch (err) {
        setEventError(err instanceof Error ? err.message : 'Failed to load event.');
      } finally {
        setEventLoading(false);
      }
    }

    void load();
  }, [eventId]);

  // ─── Process scanned QR ─────────────────────────────────────────────────────
  const processQR = useCallback(
    async (rawText: string) => {
      const round = selectedRoundRef.current;

      if (!round) {
        addToast('warn', '⚠ Please select a round before scanning.');
        return;
      }

      setProcessing(true);
      processingRef.current = true;

      try {
        // Parse JSON payload
        let parsed: { participantCode?: string; eventId?: string };

        try {
          parsed = JSON.parse(rawText) as { participantCode?: string; eventId?: string };
        } catch {
          addToast('error', '❌ Invalid QR — not an AttendX code');
          addScanEntry({
            name: '—',
            round,
            time: new Date(),
            status: 'error',
            message: 'Invalid QR format'
          });
          return;
        }

        if (!parsed.participantCode || !parsed.eventId) {
          addToast('error', '❌ Malformed QR — missing required fields');
          addScanEntry({
            name: '—',
            round,
            time: new Date(),
            status: 'error',
            message: 'Malformed QR data'
          });
          return;
        }

        // Validate event ID
        if (parsed.eventId !== eventId) {
          addToast('error', '❌ Wrong event — this QR belongs to a different event');
          addScanEntry({
            name: '—',
            round,
            time: new Date(),
            status: 'error',
            message: 'QR belongs to a different event'
          });
          return;
        }

        // Record attendance
        const name = await recordAttendance(eventId, parsed.participantCode, round);

        addToast('success', `✅ ${name} checked in for ${round}`);
        addScanEntry({ name, round, time: new Date(), status: 'success', message: `Checked in for ${round}` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Scan failed';
        addToast('error', `❌ ${msg}`);
        addScanEntry({ name: '—', round, time: new Date(), status: 'error', message: msg });
      } finally {
        setProcessing(false);
        processingRef.current = false;
      }
    },
    [eventId]
  );

  // Keep processQR accessible from scanner callback via ref
  const processQRRef = useRef(processQR);
  useEffect(() => {
    processQRRef.current = processQR;
  }, [processQR]);

  // ─── Start camera scanner (once event is loaded) ────────────────────────────
  useEffect(() => {
    if (!event) return; // wait for event to load

    let isActive = true;

    async function startCamera() {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!isActive) return;

      const qr = new Html5Qrcode('qr-region');
      html5QrRef.current = qr as unknown as typeof html5QrRef.current;

      try {
        await qr.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 }
          },
          (decodedText: string) => {
            // Debounce + busy guard
            const now = Date.now();

            if (now - lastScanRef.current < SCAN_COOLDOWN_MS) return;
            if (processingRef.current) return;

            lastScanRef.current = now;
            void processQRRef.current(decodedText);
          },
          undefined // suppress per-frame "no QR" errors
        );

        if (isActive) setScanning(true);
      } catch {
        if (isActive) {
          setCameraError(
            'Camera blocked. Tap the lock icon in your browser URL bar and allow camera access, then refresh.'
          );
        }
      }
    }

    void startCamera();

    return () => {
      isActive = false;

      void (async () => {
        const qr = html5QrRef.current;

        if (qr?.isScanning) {
          await qr.stop();
          setScanning(false);
        }
      })();
    };
  }, [event]);

  // ─── Render helpers ──────────────────────────────────────────────────────────
  const toastBg: Record<Toast['kind'], string> = {
    success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
    error: 'border-red-500/40 bg-red-500/15 text-red-200',
    warn: 'border-amber-500/40 bg-amber-500/15 text-amber-200'
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Toast stack ─────────────────────────────────────────────────── */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex max-w-xs items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur-sm ${toastBg[t.kind]}`}
          >
            <span className="flex-1 leading-5">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              className="mt-0.5 shrink-0 text-xs opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">

        {/* Header */}
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">AttendX · Volunteer</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {eventLoading ? 'Loading event…' : (event?.name ?? 'Event Scanner')}
          </h1>
          {eventError ? (
            <p className="mt-2 text-sm text-red-400">{eventError}</p>
          ) : null}
        </header>

        {/* Round selector */}
        {event && event.rounds.length > 0 ? (
          <section aria-label="Round selector">
            <p className="mb-2 text-center text-xs uppercase tracking-widest text-slate-400">
              Current Round
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {event.rounds.map((round) => (
                <button
                  key={round}
                  onClick={() => setSelectedRound(round)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    selectedRound === round
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white'
                  }`}
                >
                  {round}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Camera viewfinder */}
        <section className="relative">
          {/* Status indicator row */}
          <div className="mb-2 flex items-center justify-center gap-2 text-xs text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                processing
                  ? 'animate-ping bg-amber-400'
                  : scanning
                    ? 'animate-pulse bg-emerald-400'
                    : 'bg-slate-600'
              }`}
            />
            <span>
              {processing
                ? 'Processing…'
                : scanning
                  ? 'Ready to scan'
                  : cameraError
                    ? 'Camera error'
                    : 'Starting camera…'}
            </span>
          </div>

          {/* Camera container — html5-qrcode injects <video> here */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/60">
            <div
              id="qr-region"
              className="w-full"
              style={{ minHeight: 340 }}
            />

            {/* Scanning line overlay */}
            {scanning && !processing && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[260px] w-[260px]">
                  {/* Corner brackets */}
                  <div className="absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-indigo-400" />
                  <div className="absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-indigo-400" />
                  <div className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-indigo-400" />
                  <div className="absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-indigo-400" />
                  {/* Sweeping scan line */}
                  <div className="animate-scan-sweep absolute left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-80" />
                </div>
              </div>
            )}

            {/* Processing overlay */}
            {processing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500/30 border-t-indigo-400" />
                  <p className="text-sm font-medium text-indigo-300">Verifying…</p>
                </div>
              </div>
            )}

            {/* Camera error state */}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 p-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-3xl">📷</span>
                  <p className="text-sm leading-6 text-slate-300">{cameraError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-1 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium hover:bg-indigo-500"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected round badge */}
          {selectedRound ? (
            <p className="mt-3 text-center text-xs text-slate-400">
              Scanning for{' '}
              <span className="font-semibold text-indigo-300">{selectedRound}</span>
            </p>
          ) : null}
        </section>

        {/* Recent scans */}
        {recentScans.length > 0 ? (
          <section>
            <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">
              Recent Scans
            </p>
            <div className="flex flex-col gap-2">
              {recentScans.map((scan, idx) => (
                <div
                  key={scan.id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                    scan.status === 'success'
                      ? 'border-emerald-500/20 bg-emerald-500/10'
                      : 'border-red-500/20 bg-red-500/10'
                  } ${idx === 0 ? 'ring-1 ring-white/10' : 'opacity-70'}`}
                >
                  <span className="text-lg leading-none">
                    {scan.status === 'success' ? '✅' : '❌'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{scan.name}</p>
                    <p className={`text-xs ${scan.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {scan.status === 'success' ? scan.round : scan.message}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {scan.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-center text-xs text-slate-600">
            Scans will appear here
          </p>
        )}

        {/* Footer note */}
        <p className="text-center text-[11px] leading-5 text-slate-700">
          AttendX · Volunteer scanner · Point the camera at a participant&apos;s QR code
        </p>
      </div>
    </main>
  );
}
