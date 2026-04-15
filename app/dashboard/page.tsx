'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { createEvent, getOrganizerEvents, type EventRecord } from '@/lib/events';

type EventFormState = {
  name: string;
  description: string;
  rounds: string;
};

const initialFormState: EventFormState = {
  name: '',
  description: '',
  rounds: 'Entry, Round 1, Finals, Exit'
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formState, setFormState] = useState<EventFormState>(initialFormState);
  const [saving, setSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      if (!user) {
        setEvents([]);
        setPageLoading(false);
        return;
      }

      try {
        setPageLoading(true);
        const organizerEvents = await getOrganizerEvents(user.uid);
        setEvents(organizerEvents);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load events');
      } finally {
        setPageLoading(false);
      }
    }

    if (!loading) {
      void loadEvents();
    }
  }, [loading, user]);

  const parsedRounds = useMemo(
    () => formState.rounds.split(',').map((round) => round.trim()).filter(Boolean),
    [formState.rounds]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError('You must be signed in to create an event.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await createEvent({
        name: formState.name,
        description: formState.description,
        organizerId: user.uid,
        rounds: parsedRounds
      });

      setFormState(initialFormState);
      setIsCreateOpen(false);
      const organizerEvents = await getOrganizerEvents(user.uid);
      setEvents(organizerEvents);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-300">Organizer dashboard</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your events</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Create new attendance events and manage the round structure for each one.
            </p>
          </div>
          <Button className="shrink-0" onClick={() => setIsCreateOpen(true)}>
            Create Event
          </Button>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {pageLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
            Loading events...
          </div>
        ) : events.length === 0 ? (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>No events yet</CardTitle>
              <CardDescription>Start by creating your first event and defining its attendance rounds.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsCreateOpen(true)}>Create your first event</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.map((eventItem) => (
              <Link key={eventItem.id} href={`/dashboard/${eventItem.id}`} className="group block">
                <Card className="h-full border-white/10 bg-white/5 text-white shadow-xl shadow-black/20 transition-colors group-hover:border-indigo-500/40 group-hover:bg-white/[0.07]">
                  <CardHeader>
                    <CardTitle>{eventItem.name}</CardTitle>
                    <CardDescription className="text-slate-300">{eventItem.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>Created</span>
                      <span>{eventItem.createdAt ? eventItem.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>Rounds</span>
                      <span>{eventItem.rounds.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {eventItem.rounds.map((round) => (
                        <span key={round} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">
                          {round}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-400 opacity-0 transition-opacity group-hover:opacity-100">
                      View participants →
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">New event</p>
                <h2 className="mt-2 text-2xl font-semibold">Create event</h2>
              </div>
              <button
                className="rounded-full px-3 py-1 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="name">
                  Event Name
                </label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Tech Fest 2026"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-950 outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Describe the event and attendance rules"
                  value={formState.description}
                  onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="rounds">
                  Rounds
                </label>
                <Input
                  id="rounds"
                  name="rounds"
                  placeholder="Entry, Round 1, Finals, Exit"
                  value={formState.rounds}
                  onChange={(event) => setFormState((current) => ({ ...current, rounds: event.target.value }))}
                  required
                />
                <p className="text-xs text-slate-400">Comma-separated list. Parsed values: {parsedRounds.join(' | ')}</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}