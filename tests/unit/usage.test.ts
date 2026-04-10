import { emptyUsage } from '../../runtime/usage';

describe('runtime/usage.ts', () => {
  it('should return an empty usage object', () => {
    const usage = emptyUsage();
    expect(usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
