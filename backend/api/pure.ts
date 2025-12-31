import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, method } = req;
  const path = url?.replace('/api', '') || '/';

  try {
    // Route handling
    if (method === 'GET' && path === '/') {
      return res.status(200).json({
        message: 'Syspro API is working!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    if (method === 'GET' && path === '/health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    }

    if (method === 'POST' && path === '/test-login') {
      const { email, password } = req.body || {};

      if (email === 'admin@syspro.com' && password === 'Admin@123') {
        return res.status(200).json({
          success: true,
          message: 'Login successful',
          user: {
            email: 'admin@syspro.com',
            role: 'ADMIN',
            firstName: 'Super',
            lastName: 'Admin'
          }
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (method === 'GET' && path === '/users') {
      return res.status(200).json({
        users: [
          {
            id: '1',
            email: 'admin@syspro.com',
            firstName: 'Super',
            lastName: 'Admin',
            role: 'ADMIN',
            createdAt: new Date().toISOString()
          }
        ]
      });
    }

    // 404 for unknown routes
    return res.status(404).json({
      error: 'Not Found',
      message: `Route ${method} ${path} not found`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}