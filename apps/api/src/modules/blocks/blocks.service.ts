import { Injectable } from '@nestjs/common';
import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { splitToBlocks } from './utils/segmenter';
import { randomUUID } from 'crypto';

type Row = { rowId: string, text: string };
type Block = { id: string, projectId: string, kind: 'mono'|'dialog', speaker?: string|null, rows: Row[], text: string };

const MEM_DB = new Map<string, Block>();

@Injectable()
export class BlocksService {
  create(dto: CreateBlockDto) {
    const blocks = splitToBlocks(dto.kind, dto.text);
    // MVP: tạo 1 block từ toàn bộ input (đúng “Block-first” theo đoạn/turn)  :contentReference[oaicite:13]{index=13}
    // Ở đây ta ghép các rows của tất cả block-đoạn/turn lại thành 1 Block đơn giản cho Day 2.
    const flatRows: Row[] = blocks.flatMap(b => b.rows.map(t => ({ rowId: randomUUID(), text: t })));
    const id = randomUUID();
    const block: Block = { id, projectId: dto.projectId, kind: dto.kind, rows: flatRows, text: dto.text };
    MEM_DB.set(id, block);
    return block;
  }

  update(id: string, dto: UpdateBlockDto) {
    const cur = MEM_DB.get(id);
    if (!cur) throw new Error('BlockNotFound');
    const nextText = dto.text ?? cur.text;
    const nextKind = dto.kind ?? cur.kind;
    const rows = splitToBlocks(nextKind, nextText).flatMap(b => b.rows.map(t => ({ rowId: randomUUID(), text: t })));
    const next: Block = { ...cur, kind: nextKind, text: nextText, rows };
    MEM_DB.set(id, next);
    return next;
  }

  get(id: string) {
    const cur = MEM_DB.get(id);
    if (!cur) throw new Error('BlockNotFound');
    return cur;
  }
}
