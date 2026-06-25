'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collectionGroup, getDocs, query, where, documentId, getDoc } from 'firebase/firestore';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getFirebaseDb } from '@/lib/firebase';

type EventInfo = {
  id: string;
  name: string;
  rounds: string[];
};

type ParticipantRecord = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  participantCode: string;
};

type AttendanceRecord = {
  id: string;
  eventId: string;
  participantCode: string;
  round: string;
  status: string;
};

export default function ParticipantViewPage() {
  const { participantCode } = useParams<{ participantCode: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [participantInfo, setParticipantInfo] = useState<{name: string, email: string} | null>(null);
  const [events, setEvents] = useState<Record<string, EventInfo>>({});
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!participantCode) return;

    async function loadData() {
      try {
        setLoading(true);
        const db = getFirebaseDb();
        if (!db) throw new Error('Firebase not initialized');

        // Fetch participant records across all events
        const participantsSnap = await getDocs(
          query(collectionGroup(db, 'participants'), where('participantCode', '==', participantCode))
        );

        if (participantsSnap.empty) {
          setError('Participant not found.');
          setLoading(false);
          return;
        }

        const participantRecords: ParticipantRecord[] = [];
        let pName = '';
        let pEmail = '';

        participantsSnap.forEach((doc) => {
          const data = doc.data();
          const eventId = doc.ref.parent.parent?.id || '';
          participantRecords.push({
            id: doc.id,
            eventId,
            name: data.name,
            email: data.email,
            participantCode: data.participantCode
          });
          pName = data.name;
          pEmail = data.email;
        });

        setParticipantInfo({ name: pName, email: pEmail });

        const eventIds = participantRecords.map((p) => p.eventId);

        // Fetch events info
        const eventsData: Record<string, EventInfo> = {};

        // Find unique event references
        const eventRefs = new Map();
        for (const docSnap of participantsSnap.docs) {
          const eventRef = docSnap.ref.parent.parent;
          if (eventRef && !eventRefs.has(eventRef.id)) {
            eventRefs.set(eventRef.id, eventRef);
          }
        }

        // Fetch all events concurrently
        const eventDocs = await Promise.all(
          Array.from(eventRefs.values()).map(ref => getDoc(ref))
        );

        for (const eventDoc of eventDocs) {
          if (eventDoc.exists()) {
            const data = eventDoc.data() as { name?: string; rounds?: string[] };
            eventsData[eventDoc.id] = {
                id: eventDoc.id,
                name: data.name || 'Unknown Event',
                rounds: data.rounds || []
            };
          }
        }

        setEvents(eventsData);

        // Fetch attendance records across all events
        const attendanceSnap = await getDocs(
          query(collectionGroup(db, 'attendance'), where('participantCode', '==', participantCode), where('status', '==', 'valid'))
        );

        const attendanceRecords: AttendanceRecord[] = [];
        attendanceSnap.forEach((doc) => {
          const data = doc.data();
          const eventId = doc.ref.parent.parent?.id || '';
          attendanceRecords.push({
            id: doc.id,
            eventId,
            participantCode: data.participantCode,
            round: data.round,
            status: data.status
          });
        });

        setAttendance(attendanceRecords);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [participantCode]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 md:p-12">
        <div className="mx-auto max-w-3xl text-center text-slate-400">Loading your profile...</div>
      </main>
    );
  }

  if (error || !participantInfo) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 md:p-12">
        <div className="mx-auto max-w-3xl text-center text-red-400">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="pt-6">
              <p>{error || 'Participant not found.'}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Calculate stats per event
  const eventStats = Object.keys(events).map(eventId => {
      const event = events[eventId];
      const eventAttendance = attendance.filter(a => a.eventId === eventId);
      const attendedRounds = eventAttendance.map(a => a.round);

      const requiredRounds = event.rounds.length;
      const isEligible = requiredRounds === 0 || attendedRounds.length >= requiredRounds;

      return {
          event,
          attendedRounds,
          isEligible
      };
  });

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Proof of Attendance</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{participantInfo.name}</h1>
            <p className="mt-2 text-slate-400">{participantInfo.email}</p>
            <div className="mt-4 flex justify-center">
                <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 font-mono text-indigo-300">
                {participantCode}
                </Badge>
            </div>
        </div>

        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Events Attended</h2>

            {eventStats.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                    No events found for this participant code.
                </div>
            ) : (
                <div className="grid gap-4">
                    {eventStats.map(stat => (
                        <Card key={stat.event.id} className="border-white/10 bg-white/5">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg text-white">{stat.event.name}</CardTitle>
                                        <CardDescription className="text-slate-400 mt-1">
                                            {stat.event.rounds.length} Total Rounds
                                        </CardDescription>
                                    </div>
                                    {stat.isEligible ? (
                                        <Badge className="bg-emerald-500/20 text-emerald-300 border-0">
                                            Certificate Eligible
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-300 border-amber-500/30 bg-amber-500/10">
                                            Partial Attendance
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="text-sm text-slate-400">Completed Rounds:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {stat.attendedRounds.length > 0 ? (
                                            stat.attendedRounds.map(round => (
                                                <Badge key={round} variant="secondary" className="bg-white/10 text-slate-200">
                                                    {round}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-sm text-slate-500">None yet</span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </div>
    </main>
  );
}
