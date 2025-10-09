import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import IORedis from 'ioredis';
import { JobsService } from './jobs.service';
import { CreateTtsJobDto, TtsJobPayload } from './jobs.dto';
import { BlocksService } from '../blocks/blocks.service';

const redisOpts = { maxRetriesPerRequest: null as any, enableReadyCheck: false };

@Controller('jobs')
export class JobsController {
  private readonly kv = new IORedis(process.env.REDIS_URL!, redisOpts);

  constructor(
    private readonly svc: JobsService,
    private readonly blocks: BlocksService,
  ) {}

  @Post('tts')
  async createTts(@Body() dto: CreateTtsJobDto): Promise<{ jobId: string }> {
    if (!dto.blockId) throw new NotFoundException('blockId required');

    let rows = Array.isArray(dto.rows) ? dto.rows : [];
    if (!rows.length) {
      try {
        const block = this.blocks.get(dto.blockId);
        rows = block.rows ?? [];
      } catch (err) {
        throw new NotFoundException('Block not found');
      }
    }

    if (!rows.length) throw new NotFoundException('Block has no rows');

    const engine = dto.engine || process.env.ENGINE_DEFAULT || 'piper';
    const payload: TtsJobPayload = {
      blockId: dto.blockId,
      rows,
      engine,
      projectId: dto.projectId,
    };
    const { jobId } = await this.svc.create(payload);
    return { jobId };
  }

  @Get(':id/stream')
  async stream(@Param('id') id: string, @Res() res: Response, @Req() req: Request) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as any).flushHeaders?.();

    const channel = `progress:${id}`;
    const sub = new IORedis(process.env.REDIS_URL!, redisOpts);

    const heartbeat = setInterval(() => {
      if (!(res as any).writableEnded) res.write(`:hb\n\n`);
    }, 15_000);

    let finalized = false;
    let closing = false;
    let lastPayload = '';

    const cleanup = () => {
      if (closing) return;
      closing = true;
      clearInterval(heartbeat);
      try { sub.off('message', onMessageHandler); } catch {}
      try { sub.unsubscribe(channel).catch(() => {}); } catch {}
      try { sub.disconnect(false); } catch {}
      if (!res.writableEnded) res.end();
    };

    const send = (payload: any) => {
      if (finalized || closing) return;
      try {
        const serialized = JSON.stringify(payload);
        if (serialized === lastPayload) return;
        lastPayload = serialized;
        res.write(`data: ${serialized}\n\n`);
        if (payload?.type === 'final') {
          finalized = true;
          setImmediate(cleanup);
        }
      } catch {}
    };

    const onMessageHandler = (ch: string, message: string) => {
      if (ch !== channel || (res as any).writableEnded || closing) return;
      try {
        send(JSON.parse(message));
      } catch {}
    };

    await sub.subscribe(channel);
    sub.on('message', onMessageHandler);
    sub.on('end', cleanup);
    sub.on('error', cleanup);

    // Replay snapshot after subscribe to avoid races
    this.kv.get(`${channel}:last`).then(snap => {
      if (snap) {
        try {
          send(JSON.parse(snap));
        } catch {}
      }
    }).catch(() => {});

    const onClose = () => cleanup();
    res.on('close', onClose);
    req.on('close', onClose);
    (req as any).on?.('aborted', onClose);
  }

  @Get(':id/status')
  async status(@Param('id') id: string) {
    let snapshot: any = null;
    try {
      const ch = `progress:${id}`;
      const cached = await this.kv.get(`${ch}:last`);
      if (cached) {
        snapshot = JSON.parse(cached);
      }
    } catch {}

    const job = await this.svc.get(id);
    if (!job) {
      return {
        id,
        state: snapshot?.state ?? 'waiting',
        found: false,
        snapshot: snapshot ?? null,
      };
    }

    let state = snapshot?.state as string | undefined;
    if (!state) {
      try {
        const jobState = await job.getState();
        state = jobState === 'completed' ? 'done'
          : jobState === 'failed' ? 'error'
          : jobState ?? 'unknown';
      } catch {
        state = 'unknown';
      }
    }

    return {
      id: job.id,
      state: state ?? 'unknown',
      found: true,
      snapshot: snapshot ?? null,
    };
  }
}
