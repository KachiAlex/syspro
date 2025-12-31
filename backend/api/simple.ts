import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSimpleApp } from '../src/main-simple';

let server: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!server) {
      console.log('Creating simple app...');
      const app = await createSimpleApp();
      await app.init();
      server = app.getHttpAdapter().getInstance();
      console.log('Simple app created successfully');
    }

    return server(req, res);
  } catch (error) {
    console.error('Error in simple handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}