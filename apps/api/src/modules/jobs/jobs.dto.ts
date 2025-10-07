export interface RowInput {
  rowId: string;
  text: string;
}

// Request DTO từ FE -> rows có thể vắng, API sẽ expand nếu thiếu
export class CreateTtsJobDto {
  blockId!: string;
  engine?: 'piper' | 'xtts';
  rows?: RowInput[];
  projectId?: string;
}

// Payload thực tế đẩy vào BullMQ (rows bắt buộc)
export interface TtsJobPayload {
  blockId: string;
  rows: RowInput[];
  engine: string;
  projectId?: string;
}

export interface RowMetrics {
  lufsIntegrated: number;
  truePeakDb: number;
  clippingPct: number;
  score: number;
  warnings: string[];
}

export type RowProgress =
  | {
      type: 'row';
      rowIndex: number;
      total: number;
      state: 'running';
    }
  | {
      type: 'row';
      rowIndex: number;
      total: number;
      state: 'done';
      fileKey: string;
      bytes: number;
      durationMs: number;
      metrics: RowMetrics;
    }
  | {
      type: 'final';
      state: 'done';
      manifestKey: string;
      qcSummary: {
        rowsPass: number;
        rowsFail: number;
        blockLufs?: number;
        blockTruePeakDb?: number;
        blockClippingPct?: number;
      };
      mergedKey?: string;
    }
  | {
      type: 'final';
      state: 'error';
      error: string;
      atRow?: number;
    };
