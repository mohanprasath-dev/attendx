import { type AttendanceRecord } from './attendance';
import { type Participant } from './participants';

export type EligibilityResult = {
  roundsAttended: string[];
  eligible: boolean;
  percentage: number;
};

export function computeEligibility(
  participants: Participant[],
  attendanceRecords: AttendanceRecord[],
  rounds: string[],
  threshold = 1.0
): Record<string, EligibilityResult> {
  const result: Record<string, EligibilityResult> = {};

  // Initialize for all participants
  for (const participant of participants) {
    result[participant.participantCode] = {
      roundsAttended: [],
      eligible: false,
      percentage: 0
    };
  }

  // Populate attended rounds
  for (const record of attendanceRecords) {
    if (record.status === 'valid') {
      const code = record.participantCode;
      if (result[code] && !result[code].roundsAttended.includes(record.round)) {
        result[code].roundsAttended.push(record.round);
      }
    }
  }

  // Calculate percentage and eligibility
  const requiredRounds = rounds.length;
  for (const code in result) {
    const participantStats = result[code];
    if (requiredRounds > 0) {
      participantStats.percentage = participantStats.roundsAttended.length / requiredRounds;
      participantStats.eligible = participantStats.percentage >= threshold;
    } else {
      // If no rounds are defined, consider everyone eligible
      participantStats.percentage = 1.0;
      participantStats.eligible = true;
    }
  }

  return result;
}
