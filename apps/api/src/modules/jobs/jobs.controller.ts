import { Body, Controller, Get, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { JobsService } from './jobs.service';
import IORedis from 'ioredis';
import { CreateTtsJobDto } from './jobs.dto';
import { Response } from 'express';

const redisOpts = { maxRetriesPerRequest: null as any, enableReadyCheck: false };

@Controller('jobs')
export class JobsController {
  private sub = new IORedis(process.env.REDIS_URL!, redisOpts);
  private kv  = new IORedis(process.env.REDIS_URL!, redisOpts);

  constructor(private readonly svc: JobsService) {}

  @Post('tts')
  async createTts(@Body() dto: CreateTtsJobDto) {
    const jobId = await this.svc.create(dto);
    return { jobId };
  }
  
  @Get(':id/stream')
  async stream(@Param('id') id: string, @Res() res: Response) {   // ⬅️ gán type cho res
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // types của Express không khai báo flushHeaders; cast nhẹ:
    (res as any).flushHeaders?.();

    const ch = `progress:${id}`;

    // 1) replay snapshot
    try {
      const snap = await this.kv.get(`${ch}:last`);
      if (snap) res.write(`data: ${snap}\n\n`);
    } catch {}

    // 2) heartbeat
    const hb: NodeJS.Timeout = setInterval(() => {
      if (!(res as any).writableEnded) res.write(`: ping\n\n`);
    }, 20_000);

    // 3) subscribe PubSub
    const onMsg = (channel: string, message: string) => {         // ⬅️ gán type cho channel
      if (channel === ch && !(res as any).writableEnded) {
        res.write(`data: ${message}\n\n`);
      }
    };
    await this.sub.subscribe(ch);
    this.sub.on('message', onMsg);

    // 4) cleanup
    const clean = async () => {
      clearInterval(hb);
      try { await this.sub.unsubscribe(ch); } catch {}
      this.sub.off('message', onMsg);
      res.end();
    };
    res.on('close', clean);
    (res.req as any)?.on?.('aborted', clean);
  }

  @Get(':id/status')
  async status(@Param('id') id: string) {
    const ch = `progress:${id}`;
    const snap = await this.kv.get(`${ch}:last`);
    if (!snap) throw new NotFoundException({ jobId: id, state: 'unknown' });
    try {
      return JSON.parse(snap);
    } catch {
      throw new NotFoundException({ jobId: id, state: 'invalid' });
    }
  }
}
