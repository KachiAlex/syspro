import axios from 'axios';

const ATTENDANCE_API_BASE_URL = process.env.NEXT_PUBLIC_ATTENDANCE_API_BASE_URL || '';
const ATTENDANCE_API_KEY = process.env.NEXT_PUBLIC_ATTENDANCE_API_KEY || '';

function logError(context: string, error: any) {
  // Replace with a real logger if available
  // eslint-disable-next-line no-console
  console.error(`[Attendance Integration] ${context}:`, error);
}

export async function isEngineerOnDuty(engineerId: string) {
  try {
    if (!ATTENDANCE_API_BASE_URL) return false; // safe fallback
    const response = await axios.get(`${ATTENDANCE_API_BASE_URL}/engineers/${engineerId}/duty`, {
      headers: {
        'Authorization': `Bearer ${ATTENDANCE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    return !!response.data?.onDuty;
  } catch (error) {
    logError('isEngineerOnDuty', error);
    // On integration failure, surface a clear error for callers
    throw new Error('Failed to check engineer duty status');
  }
}
