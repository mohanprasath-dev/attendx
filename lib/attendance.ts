import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  type Timestamp
} from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase';

export type AttendanceRecord = {
  id: string;
  participantCode: string;
  participantName: string;
  round: string;
  scannedAt: Timestamp | null;
  status: 'valid' | 'duplicate' | 'invalid';
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

/**
 * Record attendance for a participant in a given round.
 *
 * Steps:
 *  1. Verify participantCode exists in events/{eventId}/participants
 *  2. Check for an existing valid scan for the same code + round → status: "duplicate"
 *  3. Write a valid attendance record and return the participant's name
 */
export async function recordAttendance(
  eventId: string,
  participantCode: string,
  round: string
): Promise<string> {
  const firestore = requireDb();

  // 1. Verify participant exists in this event
  const participantSnap = await getDocs(
    query(
      collection(firestore, 'events', eventId, 'participants'),
      where('participantCode', '==', participantCode)
    )
  );

  if (participantSnap.empty) {
    // Write an invalid record for audit trail
    await addDoc(collection(firestore, 'events', eventId, 'attendance'), {
      participantCode,
      participantName: 'Unknown',
      round,
      scannedAt: serverTimestamp(),
      status: 'invalid'
    });

    throw new Error('Invalid QR code — participant not found in this event.');
  }

  const participantData = participantSnap.docs[0].data();
  const participantName = participantData.name as string;

  // 2. Check for duplicate — query by participantCode + round, filter by status in-app
  //    (avoids requiring a 3-field Firestore composite index)
  const existingSnap = await getDocs(
    query(
      collection(firestore, 'events', eventId, 'attendance'),
      where('participantCode', '==', participantCode),
      where('round', '==', round)
    )
  );

  const alreadyValid = existingSnap.docs.some(
    (d) => (d.data().status as string) === 'valid'
  );

  if (alreadyValid) {
    // Write duplicate record for audit trail
    await addDoc(collection(firestore, 'events', eventId, 'attendance'), {
      participantCode,
      participantName,
      round,
      scannedAt: serverTimestamp(),
      status: 'duplicate'
    });

    throw new Error(`${participantName} is already checked in for ${round}.`);
  }

  // 3. Write valid attendance record
  await addDoc(collection(firestore, 'events', eventId, 'attendance'), {
    participantCode,
    participantName,
    round,
    scannedAt: serverTimestamp(),
    status: 'valid'
  });

  return participantName;
}

/**
 * Fetch all attendance records for an event, newest first.
 */
export async function getAttendance(eventId: string): Promise<AttendanceRecord[]> {
  const firestore = requireDb();

  const snapshot = await getDocs(
    collection(firestore, 'events', eventId, 'attendance')
  );

  return snapshot.docs
    .map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<AttendanceRecord, 'id'>)
    }))
    .sort((a, b) => {
      const aTime = a.scannedAt?.toMillis?.() ?? 0;
      const bTime = b.scannedAt?.toMillis?.() ?? 0;

      return bTime - aTime; // newest first
    });
}
