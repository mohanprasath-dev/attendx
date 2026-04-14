import { addDoc, collection, getDocs, query, serverTimestamp, where, type Timestamp } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export type CreateEventInput = {
  name: string;
  description: string;
  organizerId: string;
  rounds: string[];
};

export type EventRecord = {
  id: string;
  name: string;
  description: string;
  organizerId: string;
  rounds: string[];
  createdAt: Timestamp | null;
};

function requireDb() {
  if (!db) {
    throw new Error('Firestore is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables first.');
  }

  return db;
}

export async function createEvent(data: CreateEventInput) {
  const firestore = requireDb();
  const cleanRounds = data.rounds.map((round) => round.trim()).filter(Boolean);

  const docRef = await addDoc(collection(firestore, 'events'), {
    name: data.name.trim(),
    description: data.description.trim(),
    organizerId: data.organizerId,
    rounds: cleanRounds,
    createdAt: serverTimestamp()
  });

  return docRef.id;
}

export async function getOrganizerEvents(uid: string) {
  const firestore = requireDb();
  const snapshot = await getDocs(query(collection(firestore, 'events'), where('organizerId', '==', uid)));

  return snapshot.docs
    .map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<EventRecord, 'id'>)
    }))
    .sort((left, right) => {
      const leftTime = left.createdAt?.toMillis?.() ?? 0;
      const rightTime = right.createdAt?.toMillis?.() ?? 0;

      return rightTime - leftTime;
    });
}