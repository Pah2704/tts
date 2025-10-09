"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const segmenter_1 = require("../src/modules/blocks/utils/segmenter");
beforeAll(() => {
    (0, segmenter_1.setSegmenterOptions)({ tailMergeEnabled: true, tailMergeMin: 8 });
});
function wc(s) {
    return s.trim().split(/\s+/).filter(Boolean).length;
}
describe('segmenter.splitParagraphToSentences', () => {
    test('01 – single sentence', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Xin chào thế giới.');
        expect(r).toEqual(['Xin chào thế giới.']);
    });
    test('02 – two sentences by period', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('A. B.');
        expect(r).toEqual(['A.', 'B.']);
    });
    test('03 – exclamation and question', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Tuyệt vời! Bạn ổn chứ?');
        expect(r).toEqual(['Tuyệt vời!', 'Bạn ổn chứ?']);
    });
    test('04 – ellipsis (…) works', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Nghĩ mãi… Cuối cùng cũng xong.');
        expect(r).toEqual(['Nghĩ mãi…', 'Cuối cùng cũng xong.']);
    });
    test('05 – abbreviation TP.HCM not split', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Tôi ở TP.HCM. Trời hôm nay đẹp.');
        expect(r).toEqual(['Tôi ở TP.HCM.', 'Trời hôm nay đẹp.']);
    });
    test('06 – Mr. inside sentence not split', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Mr. An đến đúng giờ.');
        expect(r).toEqual(['Mr. An đến đúng giờ.']);
    });
    test('07 – v.v. inside sentence not split', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Ta có nhiều lựa chọn, v.v. Hãy cân nhắc.');
        expect(r).toEqual(['Ta có nhiều lựa chọn, v.v. Hãy cân nhắc.']);
    });
    test('08 – number with dot 1.000 does not split mid-sentence', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Giá là 1.000 đồng hôm nay.');
        expect(r).toEqual(['Giá là 1.000 đồng hôm nay.']);
    });
    test('09 – paragraph break \\n\\n splits', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Đoạn 1. Câu 2.\n\nĐoạn 2.');
        expect(r).toEqual(['Đoạn 1.', 'Câu 2.', 'Đoạn 2.']);
    });
    test('10 – emoji does not break', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Xin chào 😊. Hôm nay ổn.');
        expect(r).toEqual(['Xin chào 😊.', 'Hôm nay ổn.']);
    });
    test('11 – messy whitespaces are trimmed', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('A.   B.   C. ');
        expect(r).toEqual(['A.', 'B.', 'C.']);
    });
    test('12 – Vietnamese capitals after punctuation', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Tốt quá! Ở đây mát.');
        expect(r).toEqual(['Tốt quá!', 'Ở đây mát.']);
    });
    test('13 – empty string returns []', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('');
        expect(r).toEqual([]);
    });
    test('14 – only spaces returns []', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('    ');
        expect(r).toEqual([]);
    });
    test('15 – USD abbreviation retained; then sentence end', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Giá 10 USD. Tốt.');
        expect(r).toEqual(['Giá 10 USD.', 'Tốt.']);
    });
    test('16 – No. abbreviation not split', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('No. 5 is good. Next.');
        expect(r).toEqual(['No. 5 is good.', 'Next.']);
    });
    test('17 – long sentence (>25 words) chunks by commas', () => {
        const long = 'Đây là một câu rất dài, được viết để kiểm tra khả năng chia nhóm thở của thuật toán, ' +
            'nó có khá nhiều từ và một vài dấu phẩy để làm mốc, nhằm đảm bảo rằng câu sẽ được tách hợp lý theo độ dài.';
        const r = (0, segmenter_1.splitParagraphToSentences)(long);
        expect(r.length).toBeGreaterThan(1);
        r.slice(0, -1).forEach(seg => {
            expect(wc(seg)).toBeGreaterThanOrEqual(10);
            expect(wc(seg)).toBeLessThanOrEqual(30);
        });
        expect(wc(r[r.length - 1])).toBeLessThanOrEqual(30);
    });
    test('18 – long sentence without commas still chunks at max', () => {
        const long = Array.from({ length: 60 }, (_, i) => `word${i + 1}`).join(' ') + '.';
        const r = (0, segmenter_1.splitParagraphToSentences)(long);
        expect(r.length).toBeGreaterThan(2);
        r.forEach(seg => expect(wc(seg)).toBeLessThanOrEqual(30));
    });
    test('19 – multi-sentence with different punctuations', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('A! B? C...');
        expect(r).toEqual(['A!', 'B?', 'C...']);
    });
    test('20 – bracket content does not confuse split', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Nội dung (ví dụ: TP.HCM) vẫn ổn. Kết thúc.');
        expect(r).toEqual(['Nội dung (ví dụ: TP.HCM) vẫn ổn.', 'Kết thúc.']);
    });
    test('21 – semicolon as breath hint in long sentence', () => {
        const s = 'Câu này dài nhiều từ; nó dùng chấm phẩy để gợi ý điểm ngắt hợp lý nhằm dễ đọc hơn và bớt dài dòng khi phát âm.';
        const r = (0, segmenter_1.splitParagraphToSentences)(s);
        expect(r.length).toBeGreaterThanOrEqual(1);
    });
    test('22 – lowercase after dot should avoid split mid-sentence', () => {
        const r = (0, segmenter_1.splitParagraphToSentences)('Ví dụ viết tắt a.b thử nghiệm. Kết thúc.');
        expect(r).toEqual(['Ví dụ viết tắt a.b thử nghiệm.', 'Kết thúc.']);
    });
});
describe('segmenter.splitToBlocks', () => {
    test('23 – mono: paragraphs -> blocks with rows', () => {
        const raw = 'Đoạn một. Câu hai.\n\nĐoạn ba!';
        const blocks = (0, segmenter_1.splitToBlocks)('mono', raw);
        expect(blocks.length).toBe(2);
        expect(blocks[0].rows.length).toBe(2);
        expect(blocks[1].rows.length).toBe(1);
    });
    test('24 – dialog: [Name]: line -> speaker and rows', () => {
        const raw = '[Nam]: Xin chào!\n[Lan]: Chào bạn, rất vui được gặp.';
        const blocks = (0, segmenter_1.splitToBlocks)('dialog', raw);
        expect(blocks.length).toBe(2);
        expect(blocks[0].speaker).toBe('Nam');
        expect(blocks[1].speaker).toBe('Lan');
        expect(blocks[0].rows[0]).toMatch(/Xin chào/);
    });
    test('25 – dialog: malformed line -> speaker Unknown', () => {
        const raw = 'Xin chào không có nhãn.\n[Lan]: Có nhãn.';
        const blocks = (0, segmenter_1.splitToBlocks)('dialog', raw);
        expect(blocks[0].speaker).toBe('Unknown');
        expect(blocks[1].speaker).toBe('Lan');
    });
});
//# sourceMappingURL=segmenter.spec.js.map