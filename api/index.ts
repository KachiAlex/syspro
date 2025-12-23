import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../backend/src/main';

let server: ReturnType<INestApplication['getHttpAdapter']>['getInstance'] | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!server) {
    const app = await createApp();
    await app.init();
    server = app.getHttpAdapter().getInstance();
  }

  return server(req, res);
}

