// Automated vendor list -> get -> patch -> restore test
// Usage: node ./scripts/test-vendors.js

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  console.log(`Testing vendors against ${BASE}`);

  try {
    const listRes = await fetch(`${BASE}/api/finance/vendors`);
    if (!listRes.ok) {
      console.error('List vendors failed', listRes.status, await listRes.text());
      process.exit(2);
    }

    const listBody = await listRes.json();
    const vendors = listBody?.vendors || [];
    console.log('Found vendors:', vendors.length);

    if (!vendors.length) {
      console.error('No vendors to test with.');
      process.exit(2);
    }

    const v = vendors[0];
    console.log('Using vendor id=', v.id, 'name=', v.name);

    // Get by ID via POST (route supports vendorId in body)
    const getRes = await fetch(`${BASE}/api/finance/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId: v.id }),
    });

    if (!getRes.ok) {
      console.error('Get vendor failed', getRes.status, await getRes.text());
      process.exit(2);
    }

    const getBody = await getRes.json();
    console.log('Get vendor result:', getBody.vendor?.id || 'none');

    const originalName = getBody.vendor?.name || v.name;
    const newName = originalName + ' (test)';

    // Patch name
    const patchRes = await fetch(`${BASE}/api/finance/vendors/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });

    if (!patchRes.ok) {
      console.error('Patch vendor failed', patchRes.status, await patchRes.text());
      process.exit(2);
    }

    const patchBody = await patchRes.json();
    console.log('Patched vendor name ->', patchBody.vendor?.name);

    // Restore original name
    const restoreRes = await fetch(`${BASE}/api/finance/vendors/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: originalName }),
    });

    if (!restoreRes.ok) {
      console.error('Restore vendor failed', restoreRes.status, await restoreRes.text());
      process.exit(2);
    }

    console.log('Restored vendor name');
    console.log('Vendor tests completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Vendor tests failed:', err?.message || err);
    process.exit(2);
  }
}

run();
