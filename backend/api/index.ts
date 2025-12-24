import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { INestApplication } from '@nestjs/common';
import createAppDefault, { createApp as createAppNamed } from '../src/main';

const resolveCreateApp = () => {
  if (typeof createAppNamed === 'function') {
    return createAppNamed;
  }
  if (typeof createAppDefault === 'function') {
    return createAppDefault;
  }
  throw new Error('createApp bootstrap function is not exported from ../src/main');
};

let server: ReturnType<INestApplication['getHttpAdapter']>['getInstance'] | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!server) {
    const createApp = resolveCreateApp();
    const app = await createApp();
    await app.init();
    server = app.getHttpAdapter().getInstance();
  }

  return server!(req, res);
}
