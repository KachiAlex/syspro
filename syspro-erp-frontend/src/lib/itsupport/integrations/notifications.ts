
import axios from 'axios';

const NOTIFY_API_BASE_URL = process.env.NEXT_PUBLIC_NOTIFY_API_BASE_URL || '';
const NOTIFY_API_KEY = process.env.NEXT_PUBLIC_NOTIFY_API_KEY || '';

function logError(context: string, error: any) {
  // Replace with a real logger if available
  // eslint-disable-next-line no-console
  console.error(`[Notification Integration] ${context}:`, error);
}

export async function sendNotification({ to, subject, message }: { to: string; subject: string; message: string }) {
  try {
    const response = await axios.post(
      `${NOTIFY_API_BASE_URL}/notify`,
      { to, subject, message },
      {
        headers: {
          'Authorization': `Bearer ${NOTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    logError('sendNotification', error);
    throw new Error('Failed to send notification');
  }
}
