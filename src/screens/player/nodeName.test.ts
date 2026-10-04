import { describe, expect, it, vi } from 'vitest';
import { nodeName } from './nodeName';

// The web client's cases (`macha-client/src/screens/player/nodeChoices.test.ts`).
describe('what the player calls the node serving a stream', () => {
  it('is the host, without the scheme or the port', () => {
    expect(nodeName('http://10.35.1.50:7438')).toBe('10.35.1.50');
    expect(nodeName('https://macnessa.macha.network')).toBe('macnessa.macha.network');
  });

  it("prefers the cluster's name for the node, and falls back to the host", () => {
    expect(nodeName('http://10.35.1.50:7438', 'corvus-fi-1')).toBe('corvus-fi-1');
    expect(nodeName('http://10.35.1.50:7438', '')).toBe('10.35.1.50');
    expect(nodeName(undefined, 'corvus-fi-1')).toBe('corvus-fi-1');
  });

  it('shows an address it cannot parse as it is, and nothing for no address', () => {
    expect(nodeName('not a url')).toBe('not a url');
    expect(nodeName(undefined)).toBeUndefined();
  });

  // React Native's URL (Libraries/Blob/URL.js) answers '' instead of throwing;
  // the tests run on Node's URL, so that is stood in for here.
  it("treats React Native's empty hostname as unparsed, not as a name", () => {
    const Real = globalThis.URL;
    vi.stubGlobal('URL', class { hostname = ''; constructor(_: string) {} });
    try {
      expect(nodeName('10.35.1.50:7438')).toBe('10.35.1.50:7438');
    } finally {
      vi.stubGlobal('URL', Real);
    }
  });
});
