import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { STORAGE, StorageNotFoundError } from '../src/storage/storage';

describe('GET /blocks/:id/manifest', () => {
  let app: INestApplication;
  const storageMock: Record<string, jest.Mock> & { readJson: jest.Mock } = {
    readJson: jest.fn(),
    getObject: jest.fn(),
    stream: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE)
      .useValue(storageMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    Object.values(storageMock).forEach((mockFn) => mockFn.mockReset());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404 + JSON body when manifest not ready', async () => {
    storageMock.readJson.mockRejectedValueOnce(new StorageNotFoundError('manifest'));

    const res = await request(app.getHttpServer()).get('/blocks/sample/manifest');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/i);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: { error: 'Manifest not ready' },
      error: 'Not Found',
    });
  });

  it('returns JSON with application/json when manifest exists', async () => {
    const manifest = {
      blockId: 'sample',
      mixKey: 'blocks/sample/merged.wav',
      qcKey: 'blocks/sample/qc.json',
      qcBlock: { oversampleFactor: 4 },
    };
    storageMock.readJson.mockResolvedValueOnce(manifest);

    const res = await request(app.getHttpServer()).get('/blocks/sample/manifest');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/i);
    expect(res.body).toEqual(manifest);
  });

  it('treats invalid manifest data as not ready', async () => {
    storageMock.readJson.mockRejectedValueOnce(new SyntaxError('Unexpected token'));

    const res = await request(app.getHttpServer()).get('/blocks/sample/manifest');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/i);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: { error: 'Manifest not ready' },
      error: 'Not Found',
    });
  });
});
