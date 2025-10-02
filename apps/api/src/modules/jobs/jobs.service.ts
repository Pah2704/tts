import { Injectable } from '@nestjs/common';
import { BlocksService } from '../blocks/blocks.service';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

type JobEvent =
  | { type: 'row-progress'; index: number; total: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

type JobState = {
  id: string;
  blockId: string;
  emitter: EventEmitter;
  timer?: NodeJS.Timeout;
  cancelled?: boolean;
};

@Injectable()
export class JobsService {
  private jobs = new Map<string, JobState>();

  constructor(private readonly blocks: BlocksService) {}

  createMock(blockId: string): { jobId: string } {
    const block = this.blocks.get(blockId);
    const jobId = randomUUID();
    const emitter = new EventEmitter();
    const state: JobState = { id: jobId, blockId, emitter };
    this.jobs.set(jobId, state);

    // Giả lập xử lý từng Row với delay ngẫu nhiên
    const rows = block.rows ?? [];
    let i = 0;

    const tick = () => {
      if (state.cancelled) return;
      if (i >= rows.length) {
        emitter.emit('event', <JobEvent>{ type: 'done' });
        return;
      }
      emitter.emit('event', <JobEvent>{ type: 'row-progress', index: i, total: rows.length });

      i += 1;
      state.timer = setTimeout(tick, 200 + Math.floor(Math.random() * 250));
    };

    // khởi động sau 150ms
    state.timer = setTimeout(tick, 150);
    return { jobId };
  }

  getEmitter(jobId: string): EventEmitter | null {
    const s = this.jobs.get(jobId);
    return s?.emitter ?? null;
  }

  cancel(jobId: string) {
    const s = this.jobs.get(jobId);
    if (!s) return;
    s.cancelled = true;
    if (s.timer) clearTimeout(s.timer);
    s.emitter.emit('event', <JobEvent>{ type: 'error', message: 'cancelled' });
    this.jobs.delete(jobId);
  }
}
