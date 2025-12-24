import { createAdminViaAPI } from '../src/scripts/create-admin-api';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use POST to seed the platform',
    });
  }

  try {
    console.log('🌱 Starting platform seed via API...');
    const result = await createAdminViaAPI();
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ Seed failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Platform seed failed',
      error: error?.message ?? 'Unknown error',
    });
  }
}
