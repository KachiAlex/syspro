import { NextResponse } from 'next/server';
import { fetchCustomerInfo, syncCustomerTicket } from '../../../../../lib/itsupport/integrations/crm';

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === 'fetchCustomer') {
    const info = await fetchCustomerInfo(body.customerId);
    return NextResponse.json(info);
  }
  if (body.action === 'syncTicket') {
    const result = await syncCustomerTicket(body.ticketId);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
