module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
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
};