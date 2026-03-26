import { NextResponse } from 'next/server';
import { sendNotification } from '../../../../../lib/itsupport/integrations/notifications';

export async function POST(request: Request) {
  const body = await request.json();
  const result = await sendNotification(body);
  return NextResponse.json(result);
}
