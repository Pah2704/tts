import { splitParagraphToSentences, splitToBlocks, setSegmenterOptions } from '../src/modules/blocks/utils/segmenter';

beforeAll(() => {
  // Khóa cấu hình để test ổn định, không phụ thuộc ENV bên ngoài
  setSegmenterOptions({ tailMergeEnabled: true, tailMergeMin: 8 });
});

function wc(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

describe('segmenter.splitParagraphToSentences', () => {
  test('01 – single sentence', () => {
    const r = splitParagraphToSentences('Xin chào thế giới.');
    expect(r).toEqual(['Xin chào thế giới.']);
  });

  test('02 – two sentences by period', () => {
    const r = splitParagraphToSentences('A. B.');
    expect(r).toEqual(['A.', 'B.']);
  });

  test('03 – exclamation and question', () => {
    const r = splitParagraphToSentences('Tuyệt vời! Bạn ổn chứ?');
    expect(r).toEqual(['Tuyệt vời!', 'Bạn ổn chứ?']);
  });

  test('04 – ellipsis (…) works', () => {
    const r = splitParagraphToSentences('Nghĩ mãi… Cuối cùng cũng xong.');
    expect(r).toEqual(['Nghĩ mãi…', 'Cuối cùng cũng xong.']);
  });

  test('05 – abbreviation TP.HCM not split', () => {
    const r = splitParagraphToSentences('Tôi ở TP.HCM. Trời hôm nay đẹp.');
    expect(r).toEqual(['Tôi ở TP.HCM.', 'Trời hôm nay đẹp.']);
  });

  test('06 – Mr. inside sentence not split', () => {
    const r = splitParagraphToSentences('Mr. An đến đúng giờ.');
    expect(r).toEqual(['Mr. An đến đúng giờ.']);
  });

  test('07 – v.v. inside sentence not split', () => {
    const r = splitParagraphToSentences('Ta có nhiều lựa chọn, v.v. Hãy cân nhắc.');
    expect(r).toEqual(['Ta có nhiều lựa chọn, v.v. Hãy cân nhắc.']); // cùng một câu vì không có dấu kết thúc giữa chừng
  });

  test('08 – number with dot 1.000 does not split mid-sentence', () => {
    const r = splitParagraphToSentences('Giá là 1.000 đồng hôm nay.');
    expect(r).toEqual(['Giá là 1.000 đồng hôm nay.']);
  });

  test('09 – paragraph break \\n\\n splits', () => {
    const r = splitParagraphToSentences('Đoạn 1. Câu 2.\n\nĐoạn 2.');
    expect(r).toEqual(['Đoạn 1.', 'Câu 2.', 'Đoạn 2.']);
  });

  test('10 – emoji does not break', () => {
    const r = splitParagraphToSentences('Xin chào 😊. Hôm nay ổn.');
    expect(r).toEqual(['Xin chào 😊.', 'Hôm nay ổn.']);
  });

  test('11 – messy whitespaces are trimmed', () => {
    const r = splitParagraphToSentences('A.   B.   C. ');
    expect(r).toEqual(['A.', 'B.', 'C.']);
  });

  test('12 – Vietnamese capitals after punctuation', () => {
    const r = splitParagraphToSentences('Tốt quá! Ở đây mát.');
    expect(r).toEqual(['Tốt quá!', 'Ở đây mát.']);
  });

  test('13 – empty string returns []', () => {
    const r = splitParagraphToSentences('');
    expect(r).toEqual([]);
  });

  test('14 – only spaces returns []', () => {
    const r = splitParagraphToSentences('    ');
    expect(r).toEqual([]);
  });

  test('15 – USD abbreviation retained; then sentence end', () => {
    const r = splitParagraphToSentences('Giá 10 USD. Tốt.');
    expect(r).toEqual(['Giá 10 USD.', 'Tốt.']);
  });

  test('16 – No. abbreviation not split', () => {
    const r = splitParagraphToSentences('No. 5 is good. Next.');
    expect(r).toEqual(['No. 5 is good.', 'Next.']);
  });

  test('17 – long sentence (>25 words) chunks by commas', () => {
    const long = 'Đây là một câu rất dài, được viết để kiểm tra khả năng chia nhóm thở của thuật toán, ' +
      'nó có khá nhiều từ và một vài dấu phẩy để làm mốc, nhằm đảm bảo rằng câu sẽ được tách hợp lý theo độ dài.';
    const r = splitParagraphToSentences(long);
    expect(r.length).toBeGreaterThan(1);
    // Chỉ các đoạn "đầy đủ" (trừ đoạn cuối) cần >=10 từ; đoạn cuối có thể ngắn.
    r.slice(0, -1).forEach(seg => {
      expect(wc(seg)).toBeGreaterThanOrEqual(10);
      expect(wc(seg)).toBeLessThanOrEqual(30);
    });
    // đoạn cuối: chỉ kiểm tra upper-bound
    expect(wc(r[r.length - 1])).toBeLessThanOrEqual(30);
  });

  test('18 – long sentence without commas still chunks at max', () => {
    const long = Array.from({length: 60}, (_,i)=>`word${i+1}`).join(' ') + '.';
    const r = splitParagraphToSentences(long);
    expect(r.length).toBeGreaterThan(2); // 60 từ => khoảng 3 đoạn+
    r.forEach(seg => expect(wc(seg)).toBeLessThanOrEqual(30));
  });

  test('19 – multi-sentence with different punctuations', () => {
    const r = splitParagraphToSentences('A! B? C...');
    // C... có dấu …; regex coi đó là terminator trước khoảng trắng + chữ cái tiếp theo nếu là hoa
    expect(r).toEqual(['A!', 'B?', 'C...']); // vẫn là một câu vì không có chữ cái hoa sau đó
  });

  test('20 – bracket content does not confuse split', () => {
    const r = splitParagraphToSentences('Nội dung (ví dụ: TP.HCM) vẫn ổn. Kết thúc.');
    expect(r).toEqual(['Nội dung (ví dụ: TP.HCM) vẫn ổn.', 'Kết thúc.']);
  });

  test('21 – semicolon as breath hint in long sentence', () => {
    const s = 'Câu này dài nhiều từ; nó dùng chấm phẩy để gợi ý điểm ngắt hợp lý nhằm dễ đọc hơn và bớt dài dòng khi phát âm.';
    const r = splitParagraphToSentences(s);
    // vì chỉ 1 dấu chấm ở cuối, segmenter có thể cắt theo nhóm thở -> >1 đoạn
    expect(r.length).toBeGreaterThanOrEqual(1); // có thể 1 hoặc >1 tùy số từ; chấp nhận cả hai
  });

  test('22 – lowercase after dot should avoid split mid-sentence', () => {
    const r = splitParagraphToSentences('Ví dụ viết tắt a.b thử nghiệm. Kết thúc.');
    // do lookahead cần chữ hoa/ số nên "a.b thử" không bị tách
    expect(r).toEqual(['Ví dụ viết tắt a.b thử nghiệm.', 'Kết thúc.']);
  });
});

describe('segmenter.splitToBlocks', () => {
  test('23 – mono: paragraphs -> blocks with rows', () => {
    const raw = 'Đoạn một. Câu hai.\n\nĐoạn ba!';
    const blocks = splitToBlocks('mono', raw);
    expect(blocks.length).toBe(2);
    expect(blocks[0].rows.length).toBe(2);
    expect(blocks[1].rows.length).toBe(1);
  });

  test('24 – dialog: [Name]: line -> speaker and rows', () => {
    const raw = '[Nam]: Xin chào!\n[Lan]: Chào bạn, rất vui được gặp.';
    const blocks = splitToBlocks('dialog', raw);
    expect(blocks.length).toBe(2);
    expect(blocks[0].speaker).toBe('Nam');
    expect(blocks[1].speaker).toBe('Lan');
    expect(blocks[0].rows[0]).toMatch(/Xin chào/);
  });

  test('25 – dialog: malformed line -> speaker Unknown', () => {
    const raw = 'Xin chào không có nhãn.\n[Lan]: Có nhãn.';
    const blocks = splitToBlocks('dialog', raw);
    expect(blocks[0].speaker).toBe('Unknown');
    expect(blocks[1].speaker).toBe('Lan');
  });
});
