// Automated vendor list -> get -> patch -> restore test
// Usage: node ./scripts/test-vendors.js

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  console.log(`Testing vendors against ${BASE}`);

  try {
    async function doFetch(url, opts, timeoutMs = 30000) {
      try {
        console.log('> REQUEST', opts?.method || 'GET', url, opts?.body ? `body=${opts.body}` : '');
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(id);
        console.log('< RESPONSE', res.status, res.statusText);
        return res;
      } catch (e) {
        if (e.name === 'AbortError') {
          console.error('< FETCH ERROR', url, 'timeout');
        } else {
          console.error('< FETCH ERROR', url, e?.message || e);
        }
        throw e;
      }
    }

    const listRes = await doFetch(`${BASE}/api/finance/vendors`);
    if (!listRes.ok) {
      const text = await listRes.text().catch(() => '<no body>');
      console.error('List vendors failed', listRes.status, text);
      process.exit(2);
    }

    const listBody = await listRes.json();
    const vendors = listBody?.vendors || [];
    console.log('Found vendors:', vendors.length);

    if (!vendors.length) {
      console.log('No vendors found — creating a test vendor');
      const createRes = await doFetch(`${BASE}/api/finance/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Vendor ' + Date.now() }),
      });

      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '<no body>');
        console.error('Create vendor failed', createRes.status, text);
        process.exit(2);
      }

      const createBody = await createRes.json();
      const v = createBody.vendor;
      if (!v) {
        console.error('Create vendor returned no vendor');
        process.exit(2);
      }
      console.log('Created test vendor', v.id);
      // continue with the created vendor
      vendors.push(v);
    }

    const v = vendors[0];
    console.log('Using vendor id=', v.id, 'name=', v.name);

    // Get by ID via POST (route supports vendorId in body)
    const getRes = await doFetch(`${BASE}/api/finance/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId: v.id }),
    });

    if (!getRes.ok) {
      const text = await getRes.text().catch(() => '<no body>');
      console.error('Get vendor failed', getRes.status, text);
      process.exit(2);
    }

    const getBody = await getRes.json();
    console.log('Get vendor result:', getBody.vendor?.id || 'none');

    const originalName = getBody.vendor?.name || v.name;
    const newName = originalName + ' (test)';

    // Patch name
    const patchRes = await doFetch(`${BASE}/api/finance/vendors/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });

    if (!patchRes.ok) {
      const text = await patchRes.text().catch(() => '<no body>');
      console.error('Patch vendor failed', patchRes.status, text);
      process.exit(2);
    }

    const patchBody = await patchRes.json();
    console.log('Patched vendor name ->', patchBody.vendor?.name);

    // Restore original name
    const restoreRes = await doFetch(`${BASE}/api/finance/vendors/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: originalName }),
    });

    if (!restoreRes.ok) {
      const text = await restoreRes.text().catch(() => '<no body>');
      console.error('Restore vendor failed', restoreRes.status, text);
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
