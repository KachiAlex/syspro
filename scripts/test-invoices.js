// Automated invoice create -> patch -> list test
// Usage: node ./scripts/test-invoices.js [count]

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const COUNT = parseInt(process.argv[2] || process.env.COUNT || '1', 10);

function nowDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function run() {
  console.log(`Testing invoices against ${BASE} (count=${COUNT})`);

  for (let i = 0; i < COUNT; i++) {
    try {
      const payload = {
        tenantSlug: 'default',
        customerName: `Auto Customer ${Date.now()}`,
        customerCode: `AUTO-${Math.random().toString(36).slice(2, 8)}`,
        invoiceNumber: `AUTO-${Date.now()}`,
        issuedDate: nowDate(0),
        dueDate: nowDate(30),
        amount: 1000 + i * 100,
        currency: '₦',
        status: 'draft',
        lineItems: [{ description: 'Automated item', quantity: 1, unitPrice: 1000 + i * 100 }],
        metadata: { items: [{ description: 'Automated item', quantity: 1, unitPrice: 1000 + i * 100 }], branch: 'Automated' },
      };

      const postRes = await fetch(`${BASE}/api/finance/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!postRes.ok) {
        console.error('POST failed', postRes.status, await postRes.text());
        continue;
      }

      const postBody = await postRes.json();
      const id = postBody?.invoice?.id;
      console.log('Created invoice id=', id);

      if (!id) continue;

      const patchPayload = { status: 'sent', notes: 'Automated update' };
      const patchRes = await fetch(`${BASE}/api/finance/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });

      if (!patchRes.ok) {
        console.error('PATCH failed', await patchRes.text());
      } else {
        const patchBody = await patchRes.json();
        console.log('Patched invoice:', patchBody?.invoice?.id || id);
      }
    } catch (err) {
      console.error('Error during test iteration:', err?.message || err);
    }
  }

  try {
    const listRes = await fetch(`${BASE}/api/finance/invoices?tenantSlug=default`);
    const listBody = await listRes.json();
    console.log('List status:', listRes.status, 'invoices:', (listBody?.invoices || []).length);
    console.log(JSON.stringify((listBody?.invoices || []).slice(0, 5), null, 2));
  } catch (err) {
    console.error('Failed to fetch list:', err?.message || err);
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(2); });
