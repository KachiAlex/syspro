import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/main';
import type { INestApplication } from '@nestjs/common';

type ExpressServer = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

let server: ExpressServer | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!server) {
    const app: INestApplication = await createApp();
    await app.init();
    const expressApp = app.getHttpAdapter().getInstance();
    server = (req, res) => expressApp(req, res);
  }

  return server(req, res);
}
