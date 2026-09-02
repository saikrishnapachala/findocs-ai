import { getConfig } from '@/lib/config';
import { jsonOk } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getConfig();
  return jsonOk({
    ok: true,
    provider: cfg.provider,
    model: cfg.provider === 'openai' ? cfg.chatModel : 'local-extractive',
    vectorStore: cfg.vectorStore,
  });
}
