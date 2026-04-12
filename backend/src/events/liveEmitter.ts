/**
 * Singleton EventEmitter for real-time platform events.
 * Import `liveEmitter` in any route and call `.emit()` after
 * a mutation.  The SSE endpoint in routes/live.ts subscribes
 * to these events and forwards them to connected clients.
 */
import { EventEmitter } from 'events';

export type LiveEventType =
  | 'new_offer'
  | 'offer_update'
  | 'payment'
  | 'new_influencer';

export interface LiveEvent {
  type: LiveEventType;
  data: Record<string, unknown>;
  ts: string;
}

const liveEmitter = new EventEmitter();
liveEmitter.setMaxListeners(200); // allow many concurrent SSE connections

export default liveEmitter;
