import { NextApiRequest, NextApiResponse } from 'next';
import { fetchReportsFromGitHub } from '../../lib/github';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const reports = await fetchReportsFromGitHub();
    return res.status(200).json({ 
      success: true, 
      message: 'Reports fetched successfully',
      count: reports.length,
      reports 
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error fetching reports',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}