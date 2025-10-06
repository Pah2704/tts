import {
  Body, Controller, Get, Param, Post, Res, Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Post('mock')
  createMock(@Body() body: { blockId: string }) {
    if (!body?.blockId) throw new Error('blockId required');
    return this.svc.createMock(body.blockId);
  }

  // SSE stream
  @Get(':id/stream')
  stream(@Param('id') id: string, @Res() res: Response, @Req() req: Request) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      // CORS: đã bật global ở main.ts — nếu cần chi tiết origin thì chỉnh ở bootstrap
    });
    res.flushHeaders?.();

    const emitter = this.svc.getEmitter(id);
    if (!emitter) {
      res.write(`event: message\ndata: ${JSON.stringify({ type: 'error', message: 'job not found' })}\n\n`);
      return res.end();
    }

    const send = (payload: unknown) => {
      res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const onEvent = (evt: unknown) => {
      send(evt);
      if ((evt as any)?.type === 'done' || (evt as any)?.type === 'error') {
        clearInterval(keepAlive);
        res.end();
      }
    };
    emitter.on('event', onEvent);

    // keep-alive mỗi 15s
    const keepAlive = setInterval(() => res.write(':\n\n'), 15000);

    // cleanup khi client ngắt (typed)
    req.on('close', () => {
      clearInterval(keepAlive);
      emitter.off('event', onEvent);
    });
  }
}