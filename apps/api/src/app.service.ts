import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot(): { ok: boolean; service: string; msg: string } {
    return { ok: true, service: 'api', msg: 'Hello from Nest API' };
  }

  getHello(): { hello: string } {
    return { hello: 'world' };
  }
}
