import axios from 'axios';

// Fetch CRM API config from environment variables
const CRM_API_BASE_URL = process.env.NEXT_PUBLIC_CRM_API_BASE_URL || '';
const CRM_API_KEY = process.env.NEXT_PUBLIC_CRM_API_KEY || '';

function logError(context: string, error: any) {
  // Replace with a real logger if available
  // eslint-disable-next-line no-console
  console.error(`[CRM Integration] ${context}:`, error);
}

export async function fetchCustomerInfo(customerId: string) {
  try {
    if (!CRM_API_BASE_URL) return { id: customerId, name: `Customer ${customerId}`, accountStatus: 'unknown' };
    const response = await axios.get(`${CRM_API_BASE_URL}/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${CRM_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    logError('fetchCustomerInfo', error);
    throw new Error('Failed to fetch customer info from CRM');
  }
}


export async function syncCustomerTicket(ticketId: string, ticketData?: any) {
  try {
    if (!CRM_API_BASE_URL) return { ok: true };
    const response = await axios.post(
      `${CRM_API_BASE_URL}/tickets/sync`,
      { ticketId, ...ticketData },
      {
        headers: {
          'Authorization': `Bearer ${CRM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    logError('syncCustomerTicket', error);
    throw new Error('Failed to sync ticket with CRM');
  }
}
