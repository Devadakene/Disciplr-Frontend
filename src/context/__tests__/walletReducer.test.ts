// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { walletReducer, DEMO_ADDRESS } from '../WalletContext';

type WalletState = ReturnType<typeof walletReducer>;

const disconnectedState: WalletState = {
  status: 'disconnected',
  sessionStatus: 'anonymous',
  address: null,
  network: null,
  balance: null,
  balanceStatus: 'idle',
  balanceError: null,
  error: null,
  isDemo: false,
};

const connectedState: WalletState = {
  status: 'connected',
  sessionStatus: 'authenticated',
  address: 'GABC',
  network: 'TESTNET',
  balance: '12.00',
  balanceStatus: 'success',
  balanceError: null,
  error: null,
  isDemo: false,
};

describe('walletReducer', () => {
  it('RESTORE_START moves to restoring/resolving and clears errors', () => {
    const state = walletReducer(
      { ...disconnectedState, error: 'previous failure' },
      { type: 'RESTORE_START' },
    );

    expect(state).toMatchObject({
      status: 'restoring',
      sessionStatus: 'resolving',
      error: null,
    });
  });

  it('RESTORE_ABORT moves a restoring session to anonymous/disconnected', () => {
    const state = walletReducer(
      { ...disconnectedState, status: 'restoring', sessionStatus: 'resolving' },
      { type: 'RESTORE_ABORT' },
    );

    expect(state.status).toBe('disconnected');
    expect(state.sessionStatus).toBe('anonymous');
    expect(state.address).toBeNull();
    expect(state.network).toBeNull();
  });

  it('RESTORE_ABORT preserves an already-connected status (guard)', () => {
    const state = walletReducer(connectedState, { type: 'RESTORE_ABORT' });

    expect(state.status).toBe('connected');
    expect(state.sessionStatus).toBe('anonymous');
    expect(state.address).toBe('GABC');
    expect(state.network).toBe('TESTNET');
  });

  it('RESTORE_ABORT preserves a non-restoring error status (guard)', () => {
    const errored = { ...disconnectedState, status: 'error' as const, error: 'boom' };
    const state = walletReducer(errored, { type: 'RESTORE_ABORT' });

    expect(state.status).toBe('error');
    expect(state.sessionStatus).toBe('anonymous');
  });

  it('CONNECT_START moves to connecting and clears the error', () => {
    const state = walletReducer(
      { ...disconnectedState, error: 'old error' },
      { type: 'CONNECT_START' },
    );

    expect(state.status).toBe('connecting');
    expect(state.error).toBeNull();
  });

  it('CONNECT_SUCCESS marks the session authenticated with address and network', () => {
    const state = walletReducer(disconnectedState, {
      type: 'CONNECT_SUCCESS',
      payload: { address: 'GSUCCESS', network: 'PUBLIC' },
    });

    expect(state).toMatchObject({
      status: 'connected',
      sessionStatus: 'authenticated',
      address: 'GSUCCESS',
      network: 'PUBLIC',
      error: null,
    });
  });

  it('CONNECT_ERROR stays authenticated when an address is already known', () => {
    const state = walletReducer(connectedState, {
      type: 'CONNECT_ERROR',
      payload: { error: 'reconnect failed' },
    });

    expect(state.status).toBe('error');
    expect(state.sessionStatus).toBe('authenticated');
    expect(state.error).toBe('reconnect failed');
  });

  it('CONNECT_ERROR is anonymous when no address is known', () => {
    const state = walletReducer(disconnectedState, {
      type: 'CONNECT_ERROR',
      payload: { error: 'access denied' },
    });

    expect(state.status).toBe('error');
    expect(state.sessionStatus).toBe('anonymous');
    expect(state.error).toBe('access denied');
  });

  it('DISCONNECT resets every wallet field', () => {
    const state = walletReducer(connectedState, { type: 'DISCONNECT' });

    expect(state).toEqual(disconnectedState);
  });

  it('DEMO_CONNECT installs the demo session', () => {
    const state = walletReducer(disconnectedState, { type: 'DEMO_CONNECT' });

    expect(state).toEqual({
      status: 'connected',
      sessionStatus: 'authenticated',
      address: DEMO_ADDRESS,
      network: 'TESTNET',
      balance: '10000.0000000',
      balanceStatus: 'success',
      balanceError: null,
      error: null,
      isDemo: true,
    });
  });

  it('BALANCE_FETCH_START enters loading and clears the balance error', () => {
    const state = walletReducer(
      { ...connectedState, balanceError: 'old error' },
      { type: 'BALANCE_FETCH_START' },
    );

    expect(state.balanceStatus).toBe('loading');
    expect(state.balanceError).toBeNull();
  });

  it('BALANCE_FETCH_SUCCESS stores the balance, trustline status and network', () => {
    const state = walletReducer(connectedState, {
      type: 'BALANCE_FETCH_SUCCESS',
      payload: { balance: '42.50', status: 'no_trustline', network: 'PUBLIC' },
    });

    expect(state.balance).toBe('42.50');
    expect(state.balanceStatus).toBe('no_trustline');
    expect(state.network).toBe('PUBLIC');
  });

  it('BALANCE_FETCH_ERROR clears the balance and records the error', () => {
    const state = walletReducer(connectedState, {
      type: 'BALANCE_FETCH_ERROR',
      payload: { error: 'horizon down' },
    });

    expect(state.balance).toBeNull();
    expect(state.balanceStatus).toBe('error');
    expect(state.balanceError).toBe('horizon down');
  });

  it('UPDATE_NETWORK changes only the network', () => {
    const state = walletReducer(connectedState, {
      type: 'UPDATE_NETWORK',
      payload: { network: 'PUBLIC' },
    });

    expect(state.network).toBe('PUBLIC');
    expect(state.address).toBe('GABC');
    expect(state.status).toBe('connected');
  });

  it('UPDATE_ADDRESS marks the session connected/authenticated', () => {
    const state = walletReducer(
      { ...disconnectedState, status: 'error' as const },
      { type: 'UPDATE_ADDRESS', payload: { address: 'GNEW' } },
    );

    expect(state).toMatchObject({
      status: 'connected',
      sessionStatus: 'authenticated',
      address: 'GNEW',
    });
  });

  it('returns the same state for unknown actions', () => {
    const state = walletReducer(connectedState, { type: 'UNKNOWN' } as never);

    expect(state).toBe(connectedState);
  });
});
