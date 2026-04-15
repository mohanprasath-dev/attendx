import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Timestamp
} from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase';

export type Participant = {
  id: string;
  name: string;
  email: string;
  participantCode: string;
  createdAt: Timestamp | null;
};

function requireDb() {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error(
      'Firestore is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables first.'
    );
  }

  return db;
}

/** Generates a UUID v4 using the Web Crypto API (available in browsers and Node 19+). */
function generateUUID(): string {
  // crypto.randomUUID is available in modern browsers and Node ≥ 19.
  // Next.js 14 on Node 18 also polyfills this via the Web Crypto API.
  return crypto.randomUUID();
}

/**
 * Add a single participant to an event.
 * Generates a UUID v4 participantCode and writes to Firestore.
 */
export async function addParticipant(
  eventId: string,
  name: string,
  email: string
): Promise<string> {
  const firestore = requireDb();
  const participantCode = generateUUID();

  const docRef = await addDoc(
    collection(firestore, 'events', eventId, 'participants'),
    {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      participantCode,
      createdAt: serverTimestamp()
    }
  );

  return docRef.id;
}

/**
 * Bulk-add participants from CSV text.
 * Expected CSV format: header row "name,email" followed by data rows.
 * Uses Firestore batch writes (max 500 per batch).
 */
export async function bulkAddParticipants(
  eventId: string,
  csvText: string
): Promise<number> {
  const firestore = requireDb();

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('CSV is empty.');
  }

  // Strip header row if it matches "name,email" (case-insensitive)
  const firstLine = lines[0].toLowerCase().replace(/\s/g, '');
  const dataLines = firstLine === 'name,email' ? lines.slice(1) : lines;

  if (dataLines.length === 0) {
    throw new Error('No participant rows found in CSV.');
  }

  const BATCH_LIMIT = 500;
  let written = 0;

  for (let offset = 0; offset < dataLines.length; offset += BATCH_LIMIT) {
    const chunk = dataLines.slice(offset, offset + BATCH_LIMIT);
    const batch = writeBatch(firestore);

    for (const line of chunk) {
      const commaIndex = line.indexOf(',');

      if (commaIndex === -1) continue; // skip malformed rows

      const name = line.slice(0, commaIndex).trim();
      const email = line.slice(commaIndex + 1).trim().toLowerCase();

      if (!name || !email) continue;

      const participantCode = generateUUID();
      const ref = collection(firestore, 'events', eventId, 'participants');
      // addDoc isn't usable inside a batch; use a doc ref with auto-generated id
      const newRef = doc(ref); // generates a new document reference with auto ID

      batch.set(newRef, {
        name,
        email,
        participantCode,
        createdAt: serverTimestamp()
      });

      written++;
    }

    await batch.commit();
  }

  return written;
}

/**
 * Fetch all participants for a given event, sorted by createdAt ascending.
 */
export async function getParticipants(eventId: string): Promise<Participant[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(
    collection(firestore, 'events', eventId, 'participants')
  );

  return snapshot.docs
    .map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<Participant, 'id'>)
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;

      return aTime - bTime;
    });
}
