import { describe, it, expect } from 'vitest';
import {
  contractExplorerUrl,
  explorerBaseUrl,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  networkLabel,
  EXPLORER_BASE_URLS as EXPLORER_BASE_URLS_FROM_EXPLORER,
} from '../explorer';
import { EXPLORER_BASE_URLS as EXPLORER_BASE_URLS_FROM_HORIZON } from '../horizon';

const TESTNET_BASE = 'https://stellar.expert/explorer/testnet';
const PUBLIC_BASE = 'https://stellar.expert/explorer/public';
const ADDR = 'GCONT3KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK';
const VALID_STELLAR_ADDR = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
const VALID_TX_HASH = 'a'.repeat(64);

describe('contractExplorerUrl', () => {
  it('builds a testnet contract URL for TESTNET', () => {
    expect(contractExplorerUrl(ADDR, 'TESTNET')).toBe(
      `${TESTNET_BASE}/contract/${ADDR}`,
    );
  });

  it('builds a public contract URL for PUBLIC', () => {
    expect(contractExplorerUrl(ADDR, 'PUBLIC')).toBe(
      `${PUBLIC_BASE}/contract/${ADDR}`,
    );
  });

  it('falls back to testnet for an unknown network string', () => {
    expect(contractExplorerUrl(ADDR, 'UNKNOWN')).toBe(
      `${TESTNET_BASE}/contract/${ADDR}`,
    );
  });

  it('returns an empty string when address is empty', () => {
    expect(contractExplorerUrl('', 'TESTNET')).toBe('');
  });

  it('URL contains the exact address passed in', () => {
    const url = contractExplorerUrl(ADDR, 'PUBLIC');
    expect(url).toContain(ADDR);
  });

  it('testnet and public URLs differ only by the network segment', () => {
    const testnet = contractExplorerUrl(ADDR, 'TESTNET');
    const pub = contractExplorerUrl(ADDR, 'PUBLIC');
    expect(testnet).toContain('/testnet/');
    expect(pub).toContain('/public/');
    expect(testnet.replace('/testnet/', '/public/')).toBe(pub);
  });
});

describe('shared explorer base URLs', () => {
  it('reuses the same explorer base URL map from horizon', () => {
    expect(EXPLORER_BASE_URLS_FROM_HORIZON).toBe(EXPLORER_BASE_URLS_FROM_EXPLORER);
    expect(EXPLORER_BASE_URLS_FROM_HORIZON.TESTNET).toBe(EXPLORER_BASE_URLS_FROM_EXPLORER.TESTNET);
    expect(EXPLORER_BASE_URLS_FROM_HORIZON.PUBLIC).toBe(EXPLORER_BASE_URLS_FROM_EXPLORER.PUBLIC);
  });
});

describe('networkLabel', () => {
  it('returns "Mainnet" for PUBLIC', () => {
    expect(networkLabel('PUBLIC')).toBe('Mainnet');
  });

  it('returns "Testnet" for TESTNET', () => {
    expect(networkLabel('TESTNET')).toBe('Testnet');
  });

  it('returns "Testnet" for null', () => {
    expect(networkLabel(null)).toBe('Testnet');
  });

  it('returns "Testnet" for undefined', () => {
    expect(networkLabel(undefined)).toBe('Testnet');
  });

  it('returns "Testnet" for an unknown string', () => {
    expect(networkLabel('FUTURENET')).toBe('Testnet');
  });
});

describe('explorerBaseUrl', () => {
  it('returns testnet base URL for TESTNET and null', () => {
    expect(explorerBaseUrl('TESTNET')).toBe(TESTNET_BASE);
    expect(explorerBaseUrl(null)).toBe(TESTNET_BASE);
  });

  it('returns public base URL for PUBLIC', () => {
    expect(explorerBaseUrl('PUBLIC')).toBe(PUBLIC_BASE);
  });
});

describe('getExplorerTxUrl', () => {
  it('builds a public tx URL for a valid 64-hex hash on PUBLIC', () => {
    expect(getExplorerTxUrl(VALID_TX_HASH, 'PUBLIC')).toBe(
      `${PUBLIC_BASE}/tx/${VALID_TX_HASH}`,
    );
  });

  it('builds a testnet tx URL for TESTNET and null network', () => {
    expect(getExplorerTxUrl(VALID_TX_HASH, 'TESTNET')).toBe(
      `${TESTNET_BASE}/tx/${VALID_TX_HASH}`,
    );
    expect(getExplorerTxUrl(VALID_TX_HASH, null)).toBe(
      `${TESTNET_BASE}/tx/${VALID_TX_HASH}`,
    );
  });

  it('returns empty string for invalid or hostile tx hashes', () => {
    expect(getExplorerTxUrl('../../x', 'PUBLIC')).toBe('');
    expect(getExplorerTxUrl('', 'TESTNET')).toBe('');
    expect(getExplorerTxUrl('short', 'TESTNET')).toBe('');
    expect(getExplorerTxUrl('abc def 1234', 'PUBLIC')).toBe('');
  });
});

describe('getExplorerAccountUrl', () => {
  it('builds account URLs from explorerBaseUrl for PUBLIC, TESTNET, and null', () => {
    expect(getExplorerAccountUrl(VALID_STELLAR_ADDR, 'PUBLIC')).toBe(
      `${PUBLIC_BASE}/account/${VALID_STELLAR_ADDR}`,
    );
    expect(getExplorerAccountUrl(VALID_STELLAR_ADDR, 'TESTNET')).toBe(
      `${TESTNET_BASE}/account/${VALID_STELLAR_ADDR}`,
    );
    expect(getExplorerAccountUrl(VALID_STELLAR_ADDR, null)).toBe(
      `${TESTNET_BASE}/account/${VALID_STELLAR_ADDR}`,
    );
  });

  it('returns empty string for invalid Stellar addresses', () => {
    expect(getExplorerAccountUrl('../../x', 'PUBLIC')).toBe('');
    expect(getExplorerAccountUrl('', 'TESTNET')).toBe('');
  });
});
