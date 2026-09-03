import type { Citation, Usage } from '@/lib/types';

/** A chat message as held in client state (may be mid-stream). */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  coverage?: number;
  usage?: Usage;
  provider?: string;
  streaming?: boolean;
  error?: boolean;
}
