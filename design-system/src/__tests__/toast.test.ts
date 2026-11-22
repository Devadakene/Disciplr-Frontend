import { loadTokens, getAllTokens } from '../utils/token-loader';

describe('toast tokens', () => {
  it('loads toast timing and capacity tokens from toast.json', () => {
    const tokens = loadTokens('toast.json');

    expect(tokens).toHaveProperty('toast');
    expect(tokens.toast).toMatchObject({
      defaultDurationMs: { $value: 4000 },
      maxVisible: { $value: 5 },
      reducedMotionDurationMs: { $value: 1500 },
    });
  });

  it('is included in getAllTokens()', () => {
    const all = getAllTokens();
    expect(all.toast?.defaultDurationMs?.$value).toBe(4000);
    expect(all.toast?.maxVisible?.$value).toBe(5);
    expect(all.toast?.reducedMotionDurationMs?.$value).toBe(1500);
  });

  it('pairs with the toast z-index layer', () => {
    const zIndex = loadTokens('z-index.json');
    expect(zIndex.zIndex?.toast?.$value).toBe(400);
  });
});
