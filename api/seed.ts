// Serverless endpoint to seed the platform
// Access at: /api/seed

import { createAdminViaAPI } from '../backend/src/scripts/create-admin-api';

export default async (req: any, res: any) => {
  // Simple security check - only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Use POST to seed the platform' 
    });
  }

  try {
    console.log('🌱 Starting platform seed via API...');
    const result = await createAdminViaAPI();
    
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    res.status(500).json({
      success: false,
      message: 'Platform seed failed',
      error: error.message,
    });
  }
};

