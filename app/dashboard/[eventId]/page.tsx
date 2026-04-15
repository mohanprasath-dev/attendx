'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { getOrganizerEvents, type EventRecord } from '@/lib/events';
import {
  addParticipant,
  bulkAddParticipants,
  getParticipants,
  type Participant
} from '@/lib/participants';
import { generateQRDataURL } from '@/lib/qr';

type FormState = {
  name: string;
  email: string;
};

const emptyForm: FormState = { name: '', email: '' };

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading } = useAuth();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add-participant form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // CSV upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // QR codes: participantCode → base64 data URL
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [qrLoading, setQrLoading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // ─── Load event + participants ───────────────────────────────────────────────
  useEffect(() => {
    if (loading || !eventId) return;

    async function load() {
      try {
        setPageLoading(true);
        setError(null);

        if (user) {
          const events = await getOrganizerEvents(user.uid);
          const found = events.find((e) => e.id === eventId) ?? null;
          setEvent(found);
        }

        const parts = await getParticipants(eventId);
        setParticipants(parts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setPageLoading(false);
      }
    }

    void load();
  }, [loading, user, eventId]);

  // ─── Generate QR codes whenever participants change ─────────────────────────
  useEffect(() => {
    if (participants.length === 0) {
      setQrMap({});
      return;
    }

    async function buildQRMap() {
      setQrLoading(true);

      try {
        const entries = await Promise.all(
          participants.map(async (p) => {
            const dataURL = await generateQRDataURL(p.participantCode, eventId);
            return [p.participantCode, dataURL] as const;
          })
        );

        setQrMap(Object.fromEntries(entries));
      } catch {
        // QR generation failing shouldn't block the rest of the UI
      } finally {
        setQrLoading(false);
      }
    }

    void buildQRMap();
  }, [participants, eventId]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function refreshParticipants() {
    const parts = await getParticipants(eventId);
    setParticipants(parts);
  }

  // ─── Download single QR as PNG ────────────────────────────────────────────
  function downloadQR(participant: Participant) {
    const dataURL = qrMap[participant.participantCode];

    if (!dataURL) return;

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `qr-${participant.name.replace(/\s+/g, '-').toLowerCase()}-${participant.participantCode.slice(0, 8)}.png`;
    link.click();
  }

  // ─── Download all QRs as a ZIP ────────────────────────────────────────────
  async function downloadAllQRs() {
    if (participants.length === 0) return;

    try {
      setDownloadingAll(true);

      // Dynamically import jszip so the bundle only loads it when needed
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const p of participants) {
        const dataURL = qrMap[p.participantCode];

        if (!dataURL) continue;

        // Strip "data:image/png;base64," prefix → raw base64
        const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
        const filename = `${p.name.replace(/\s+/g, '-').toLowerCase()}-${p.participantCode.slice(0, 8)}.png`;
        zip.file(filename, base64, { base64: true });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event?.name ?? eventId}-qr-codes.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate ZIP');
    } finally {
      setDownloadingAll(false);
    }
  }

  // ─── Add single participant ───────────────────────────────────────────────────
  async function handleAddSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      await addParticipant(eventId, form.name, form.email);
      setForm(emptyForm);
      setIsFormOpen(false);
      flash(`✅ ${form.name} added successfully`);
      await refreshParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add participant');
    } finally {
      setSaving(false);
    }
  }

  // ─── CSV bulk upload ─────────────────────────────────────────────────────────
  async function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const text = await file.text();
      const count = await bulkAddParticipants(eventId, text);
      flash(`✅ ${count} participants imported from CSV`);
      await refreshParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard" className="transition-colors hover:text-white">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-white">{event?.name ?? eventId}</span>
        </nav>

        {/* Header */}
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-300">Event</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              {pageLoading ? 'Loading…' : (event?.name ?? 'Event not found')}
            </h1>
            {event?.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{event.description}</p>
            ) : null}
            {event?.rounds && event.rounds.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {event.rounds.map((round) => (
                  <span
                    key={round}
                    className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30"
                  >
                    {round}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {/* Hidden file input for CSV */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              id="csv-upload"
              onChange={handleCsvUpload}
            />

            {/* Download All QRs */}
            {participants.length > 0 ? (
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void downloadAllQRs()}
                disabled={downloadingAll || qrLoading}
              >
                {downloadingAll ? 'Zipping…' : '⬇ Download All QRs'}
              </Button>
            ) : null}

            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Importing…' : '⬆ CSV Import'}
            </Button>

            <Button onClick={() => setIsFormOpen(true)}>+ Add Participant</Button>
          </div>
        </section>

        {/* Alerts */}
        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {successMsg ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMsg}
          </div>
        ) : null}

        {/* Participant list */}
        {pageLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
            Loading participants…
          </div>
        ) : participants.length === 0 ? (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>No participants yet</CardTitle>
              <CardDescription className="text-slate-400">
                Add participants manually or import a CSV with columns{' '}
                <code className="rounded bg-white/10 px-1 py-0.5 text-xs text-slate-200">name,email</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={() => setIsFormOpen(true)}>+ Add Participant</Button>
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => fileInputRef.current?.click()}
              >
                ⬆ CSV Import
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
                {qrLoading ? (
                  <span className="ml-2 text-slate-500">· generating QR codes…</span>
                ) : null}
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">QR</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Participant Code</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => {
                    const qrDataURL = qrMap[p.participantCode];

                    return (
                      <tr
                        key={p.id}
                        className="border-b border-white/5 transition-colors hover:bg-white/5 last:border-0"
                      >
                        {/* # */}
                        <td className="px-4 py-3 text-slate-500">{idx + 1}</td>

                        {/* QR preview */}
                        <td className="px-4 py-3">
                          {qrDataURL ? (
                            <img
                              src={qrDataURL}
                              alt={`QR code for ${p.name}`}
                              width={52}
                              height={52}
                              className="rounded-md border border-white/10 bg-white p-0.5"
                            />
                          ) : (
                            <div className="h-[52px] w-[52px] animate-pulse rounded-md bg-white/10" />
                          )}
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3 font-medium text-white">{p.name}</td>

                        {/* Email */}
                        <td className="px-4 py-3 text-slate-300">{p.email}</td>

                        {/* Code */}
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className="border-indigo-500/30 bg-indigo-500/10 font-mono text-[10px] text-indigo-300"
                          >
                            {p.participantCode}
                          </Badge>
                        </td>

                        {/* Joined */}
                        <td className="px-4 py-3 text-slate-400">
                          {p.createdAt ? p.createdAt.toDate().toLocaleDateString() : '—'}
                        </td>

                        {/* Download QR */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => downloadQR(p)}
                            disabled={!qrDataURL}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ⬇ Download QR
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Participant Modal */}
      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">New participant</p>
                <h2 className="mt-2 text-2xl font-semibold">Add Participant</h2>
              </div>
              <button
                className="rounded-full px-3 py-1 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setIsFormOpen(false);
                  setForm(emptyForm);
                }}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleAddSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="participant-name">
                  Full Name
                </label>
                <Input
                  id="participant-name"
                  name="participant-name"
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="participant-email">
                  Email Address
                </label>
                <Input
                  id="participant-email"
                  name="participant-email"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <p className="text-xs text-slate-500">
                A unique participant code (UUID v4) will be generated automatically on submit.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Adding…' : 'Add Participant'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
