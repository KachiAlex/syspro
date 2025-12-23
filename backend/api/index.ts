import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/main';
import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';

let server: Express | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!server) {
    const app: INestApplication = await createApp();
    await app.init();
    server = app.getHttpAdapter().getInstance();
  }

  return server!(req, res);
}
