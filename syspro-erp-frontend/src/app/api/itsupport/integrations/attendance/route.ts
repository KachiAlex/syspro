import { NextResponse } from 'next/server';
import { isEngineerOnDuty } from '../../../../../lib/itsupport/integrations/attendance';

export async function POST(request: Request) {
  const body = await request.json();
  const onDuty = await isEngineerOnDuty(body.engineerId);
  return NextResponse.json({ onDuty });
}
