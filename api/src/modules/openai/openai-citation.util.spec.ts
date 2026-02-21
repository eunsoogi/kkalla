import { toUserFacingText } from './openai-citation.util';

describe('toUserFacingText', () => {
  it('should remove openai citation marker blocks', () => {
    const raw = '이유 텍스트입니다 〖4:0†source〗';

    expect(toUserFacingText(raw)).toBe('이유 텍스트입니다');
  });

  it('should remove footnote style citations and source links', () => {
    const raw = '근거 문장[1](https://example.com/ref)[^2]\n출처: https://example.com/article';

    expect(toUserFacingText(raw)).toBe('근거 문장');
  });

  it('should keep bracket numbers in normal content while removing citation-style footnotes', () => {
    const raw = '근거 [1] 문장, MVRV[2] 지표';

    expect(toUserFacingText(raw)).toBe('근거 문장, MVRV[2] 지표');
  });

  it('should remove attached korean footnotes before punctuation', () => {
    const raw = '근거문장[1]. 다음 문장';

    expect(toUserFacingText(raw)).toBe('근거문장. 다음 문장');
  });

  it('should remove parenthesized markdown source links', () => {
    const raw =
      '근거 문장입니다. ([investing.com](https://www.investing.com/news/commodities-news/gold-prices-muted-amid-usiran-tensions-fed-caution-set-for-weekly-loss-4515095?utm_source=openai)) (confidence=0.58, expectedVolatility=+/-2.0%).';

    expect(toUserFacingText(raw)).toBe(
      '근거 문장입니다. (confidence=0.58, expectedVolatility=+/-2.0%).',
    );
  });

  it('should remove mixed markdown and raw url citation blocks', () => {
    const raw = '근거 문장 ([marketwatch.com](https://example.com/a)\n(https://example.com/b))';

    expect(toUserFacingText(raw)).toBe('근거 문장');
  });

  it('should keep plain text as-is', () => {
    const raw = '출처 없는 일반 설명입니다.';

    expect(toUserFacingText(raw)).toBe(raw);
  });

  it('should prioritize annotation ranges when provided', () => {
    const raw = '요약 문장 [1]입니다';
    const start = raw.indexOf('[1]');

    expect(
      toUserFacingText(raw, [
        {
          startIndex: start,
          endIndex: start + 3,
          type: 'url_citation',
        },
      ]),
    ).toBe('요약 문장 입니다');
  });
});
