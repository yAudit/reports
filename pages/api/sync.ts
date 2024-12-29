import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { fetchReportsFromGitHub } from '../../lib/github';

// Define types for the GitHub webhook payload
interface GitHubCommit {
  modified: string[];
  added: string[];
  removed: string[];
}

interface WebhookPayload {
  commits?: {
    modified: string[];
    added: string[];
    removed: string[];
  }[];
}

// Verify GitHub webhook signature
function verifyGitHubWebhook(req: NextApiRequest): boolean {
  const signature = req.headers['x-hub-signature-256'];
  const body = JSON.stringify(req.body);
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return false;
  }

  const computedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature as string),
    Buffer.from(computedSignature)
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    if (!verifyGitHubWebhook(req)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if the webhook is for the reports directory
    const payload = req.body as WebhookPayload;
    const isReportsUpdate = payload.commits?.some((commit: GitHubCommit) =>
      commit.modified.some((file: string) => file.startsWith('content/reports/')) ||
      commit.added.some((file: string) => file.startsWith('content/reports/')) ||
      commit.removed.some((file: string) => file.startsWith('content/reports/'))
    );

    if (!isReportsUpdate) {
      return res.status(200).json({ message: 'No reports were modified' });
    }

    // Fetch updated reports
    await fetchReportsFromGitHub();

    return res.status(200).json({ message: 'Reports synced successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}