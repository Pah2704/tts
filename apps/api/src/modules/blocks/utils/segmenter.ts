// Quy tắc tách câu theo Spec/ADR (ngoại lệ + nhóm thở).
const ABBREV = [
  'TP.HCM','P.S.','Mr.','Mrs.','Dr.','Prof.','vs.','U.S.','U.K.','No.','v.v.',
  'USD','VND','ThS.','TS.','Th.D.'
];

// ===== Segmenter options (ENV + runtime override) =====
type SegmenterOptions = {
  tailMergeEnabled: boolean;     // bật/tắt “nuốt đuôi ngắn”
  tailMergeMin: number;          // đuôi < tailMergeMin từ thì xét gộp
};
const DEFAULTS: SegmenterOptions = { tailMergeEnabled: true, tailMergeMin: 8 };
const toBool = (v: string | undefined, d = false) =>
  v === undefined ? d : !['0','false','off','no'].includes(v.toLowerCase());
const toInt = (v: string | undefined, d: number) => {
  const n = v ? Number(v) : NaN; return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};
let SEGMENTER_OPTS: SegmenterOptions = {
  tailMergeEnabled: toBool(process.env.TTS_TAIL_MERGE_ENABLED, DEFAULTS.tailMergeEnabled),
  tailMergeMin: toInt(process.env.TTS_TAIL_MERGE_MIN, DEFAULTS.tailMergeMin),
};
export function setSegmenterOptions(partial: Partial<SegmenterOptions>) {
  SEGMENTER_OPTS = { ...SEGMENTER_OPTS, ...partial };
}
export function getSegmenterOptions(): SegmenterOptions {
  return { ...SEGMENTER_OPTS };
}


// Không escape các ký tự không cần thiết (ví dụ: “…”), chỉ để nguyên trong char class.
// Dùng Unicode property escapes cho chữ hoa/số: \p{Lu}, \p{Nd} với flag /u.
const PARAGRAPH_SPLIT = /\n{2,}/;                                   // xuống dòng kép trở lên
const SENTENCE_SPLIT  = /(?<=[.!?…])\s+(?=[\p{Lu}\p{Nd}])/u;        // sau . ! ? … + khoảng trắng + trước chữ hoa/số
 

export function splitParagraphToSentences(text: string): string[] {
  if (!text.trim()) return [];
  // Bảo vệ ngoại lệ: tạm thay thế dấu chấm trong viết tắt bằng token
  let safe = text;
  const tokens: Record<string,string> = {};
  ABBREV.forEach((abbr, i) => {
    const token = `__ABBR_${i}__`;
    tokens[token] = abbr;
    const esc = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safe = safe.replace(new RegExp(esc, 'g'), token);
  });

  // B1: tách đoạn (paragraph), B2: tách câu trong từng đoạn
  const rough = safe
    .replace(/\r/g, '')
    .split(PARAGRAPH_SPLIT)
    .flatMap(p => p.split(SENTENCE_SPLIT))
    .map(s => s.trim())
    .filter(Boolean);

  // Khôi phục viết tắt
  const restored = rough.map(s => {
    Object.entries(tokens).forEach(([token,abbr]) => s = s.replaceAll(token, abbr));
    return s;
  });

  // Nhóm thở ~15–25 từ (ưu tiên dấu phẩy/chấm phẩy)  :contentReference[oaicite:12]{index=12}
  const final: string[] = [];
  const MAX = 25, MIN = 15;
  for (const s of restored) {
    const words = s.split(/\s+/);
    if (words.length <= MAX) { final.push(s); continue; }
    // cắt theo dấu phẩy/chấm phẩy gần mốc
    let cur: string[] = [];
    for (const w of words) {
      cur.push(w);
      const isBreath = /[,;]$/.test(w) || cur.length >= MAX;
      if (cur.length >= MIN && isBreath) {
        final.push(cur.join(' ')); cur = [];
      }
    }
    if (cur.length) final.push(cur.join(' '));
  }
  // Hậu xử lý: “nuốt” đuôi quá ngắn chỉ khi KHÔNG phải hai câu hoàn chỉnh.
  if (SEGMENTER_OPTS.tailMergeEnabled && final.length >= 2) {
    const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
    const term = /[.!?…]["'”)]?$/u; // câu kết thúc bằng . ! ? … (có thể kèm ngoặc/ngoặc kép)
    const last = final[final.length - 1].trim();
    const prev = final[final.length - 2].trim();
    const lastWC = wc(last);
    const prevTerm = term.test(prev);
    const lastTerm = term.test(last);

    // Chỉ gộp khi đuôi ngắn và ÍT NHẤT MỘT trong hai đoạn không phải kết thúc câu.
    // Tránh gộp 'A.' + 'B.' thành 'A. B.'.
    const TAIL_MERGE_MIN = 8;
    if (lastWC > 0 && lastWC < SEGMENTER_OPTS.tailMergeMin && (!prevTerm || !lastTerm)) {
      final[final.length - 2] = `${prev} ${last}`.replace(/\s+/g, ' ').trim();
      final.pop();
    }
  }

  return final;
}

export function splitToBlocks(kind:'mono'|'dialog', raw: string) {
  const paragraphs = raw.replace(/\r/g,'').split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
  if (kind === 'mono') {
    return paragraphs.map((p, i) => ({ blockIndex: i, speaker: null, rows: splitParagraphToSentences(p) }));
  }
  // dialog: mỗi dòng dạng [Tên]: lời thoại
  const blocks = raw.split(/\n+/).map(l => l.trim()).filter(Boolean).map((line, i) => {
    const m = line.match(/^\[([^\]]+)\]\s*:\s*(.+)$/);
    const speaker = m ? m[1].trim() : 'Unknown';
    const text = m ? m[2] : line;
    return { blockIndex: i, speaker, rows: splitParagraphToSentences(text) };
  });
  return blocks;
}
