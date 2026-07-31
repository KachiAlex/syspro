ssh#!/usr/bin/env node
/*
  Migrate resume files from Cloudinary URLs stored in admin_candidates to Cloudflare R2.
  Requires DATABASE_URL, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME, and R2_PUBLIC_URL env vars.
*/
const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const r2Endpoint = process.env.R2_ENDPOINT;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket = process.env.R2_BUCKET_NAME;
  const r2PublicUrl = process.env.R2_PUBLIC_URL;

  if (!databaseUrl || !r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey || !r2Bucket || !r2PublicUrl) {
    console.error(
      'Missing required env vars: DATABASE_URL, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL'
    );
    process.exit(1);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
    forcePathStyle: true,
  });

  const publicUrlBase = r2PublicUrl.replace(/\/+$/, '');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      `select id, tenant_slug, resume_url from admin_candidates where resume_url like '%cloudinary.com%'`
    );

    console.log(`Found ${rows.length} candidate resume(s) on Cloudinary.`);

    let migrated = 0;
    let skipped = 0;

    for (const row of rows) {
      const cloudinaryUrl = row.resume_url;
      if (!cloudinaryUrl) {
        skipped++;
        continue;
      }

      try {
        const response = await fetch(cloudinaryUrl);
        if (!response.ok) {
          console.error(`Failed to fetch ${cloudinaryUrl}: ${response.status} ${response.statusText}`);
          skipped++;
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        let filename = 'resume';
        try {
          const urlPath = new URL(cloudinaryUrl).pathname;
          const base = path.basename(urlPath);
          if (base) filename = base;
        } catch {
          // ignore parse errors
        }

        const tenantSlug = (row.tenant_slug || 'default').replace(/[^a-zA-Z0-9-]/g, '');
        const key = `resumes/${tenantSlug}/${row.id}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 80)}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: r2Bucket,
            Key: key,
            Body: fileBuffer,
            ContentType: response.headers.get('content-type') || 'application/octet-stream',
          })
        );

        const newUrl = `${publicUrlBase}/${key}`;
        await client.query('update admin_candidates set resume_url = $1 where id = $2', [newUrl, row.id]);

        console.log(`Migrated candidate ${row.id}: ${newUrl}`);
        migrated++;
      } catch (err) {
        console.error(`Error migrating candidate ${row.id}:`, err.message || err);
        skipped++;
      }
    }

    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
