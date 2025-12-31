export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { url, method } = req;
  
  // Simple routing
  if (method === 'GET' && url === '/api') {
    return res.status(200).json({
      message: 'Syspro API is working!',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
  
  if (method === 'POST' && url === '/api/login') {
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
  
  // Default response
  res.status(200).json({
    message: 'Syspro API',
    timestamp: new Date().toISOString(),
    receivedMethod: method,
    receivedUrl: url
  });
}