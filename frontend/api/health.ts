import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const apiKeyConfigured = !!process.env.OPENAI_API_KEY;
  const supabaseUrlConfigured = !!process.env.VITE_SUPABASE_URL;
  const supabaseKeyConfigured = !!process.env.VITE_SUPABASE_ANON_KEY;
  
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    services: {
      openai: apiKeyConfigured ? 'configured' : 'missing',
      supabase: {
        url: supabaseUrlConfigured ? 'configured' : 'missing',
        key: supabaseKeyConfigured ? 'configured' : 'missing'
      }
    }
  });
}