import QRCode from 'qrcode';

/**
 * Generates a QR code as a base64 PNG data URL.
 * The encoded data is a JSON string: { participantCode, eventId }
 *
 * @param participantCode - UUID v4 identifying the participant
 * @param eventId         - Firestore document ID of the event
 * @returns               - base64 data URL suitable for an <img src> or PNG download
 */
export async function generateQRDataURL(
  participantCode: string,
  eventId: string
): Promise<string> {
  const payload = JSON.stringify({ participantCode, eventId });

  return QRCode.toDataURL(payload, {
    width: 300,
    margin: 2,
    color: {
      dark: '#0f172a', // slate-950 – matches the app theme
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  });
}
