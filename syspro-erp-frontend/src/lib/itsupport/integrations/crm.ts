// CRM Integration Service Stub
export async function fetchCustomerInfo(customerId: string) {
  // TODO: Replace with real CRM API call
  return {
    id: customerId,
    name: 'Acme Corp',
    contact: 'jane.doe@acme.com',
    accountStatus: 'active',
    region: 'North',
  };
}

export async function syncCustomerTicket(ticketId: string) {
  // TODO: Push ticket info to CRM system
  return { success: true };
}
