import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from './useWallet';

const wallet = vi.hoisted(() => ({
  isConnected: vi.fn(), isAllowed: vi.fn(), requestAccess: vi.fn(),
  getPublicKey: vi.fn(), getNetwork: vi.fn(),
}));
vi.mock('@stellar/freighter-api', () => wallet);
const ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

beforeEach(() => {
  vi.resetAllMocks();
  useWallet.getState().disconnect();
  wallet.isConnected.mockResolvedValue(true);
  wallet.isAllowed.mockResolvedValue(true);
  wallet.requestAccess.mockResolvedValue(ADDRESS);
  wallet.getPublicKey.mockResolvedValue(ADDRESS);
  wallet.getNetwork.mockResolvedValue('TESTNET');
});

describe('Freighter connection state', () => {
  it('distinguishes unavailable from a declined connection', async () => {
    wallet.isConnected.mockResolvedValue(false);
    await useWallet.getState().connect();
    expect(useWallet.getState().status).toBe('unavailable');
    expect(wallet.requestAccess).not.toHaveBeenCalled();
    wallet.isConnected.mockResolvedValue(true);
    wallet.requestAccess.mockRejectedValue({ code: 4001 });
    await useWallet.getState().connect();
    expect(useWallet.getState().status).toBe('rejected');
    expect(useWallet.getState().address).toBeNull();
  });

  it('shows locked for an empty key and safe copy for unknown transport errors', async () => {
    wallet.requestAccess.mockResolvedValue('');
    await useWallet.getState().connect();
    expect(useWallet.getState().status).toBe('locked');
    wallet.requestAccess.mockRejectedValue(new Error('private transport context'));
    await useWallet.getState().connect();
    expect(useWallet.getState().status).toBe('error');
    expect(useWallet.getState().connectionError).not.toContain('private transport context');
  });

  it('tracks connected and wrong-network transitions in the shared store', async () => {
    await useWallet.getState().connect();
    expect(useWallet.getState()).toMatchObject({ status: 'connected', address: ADDRESS, isConnecting: false });
    wallet.getNetwork.mockResolvedValue('PUBLIC');
    await useWallet.getState().refreshNetwork();
    expect(useWallet.getState().status).toBe('wrong_network');
    wallet.getNetwork.mockResolvedValue('TESTNET');
    await useWallet.getState().refreshNetwork();
    expect(useWallet.getState().status).toBe('connected');
  });

  it('does not label an unknown network as connected', async () => {
    wallet.getNetwork.mockResolvedValue(null);
    await useWallet.getState().connect();
    expect(useWallet.getState()).toMatchObject({ status: 'error', address: null });
  });

  it('restores permitted access silently and leaves unapproved access disconnected', async () => {
    wallet.isAllowed.mockResolvedValue(false);
    await useWallet.getState().tryAutoReconnect();
    expect(useWallet.getState().status).toBe('disconnected');
    expect(wallet.getPublicKey).not.toHaveBeenCalled();
    wallet.isAllowed.mockResolvedValue(true);
    await useWallet.getState().tryAutoReconnect();
    expect(useWallet.getState().status).toBe('connected');
    expect(wallet.requestAccess).not.toHaveBeenCalled();
  });

  it('ignores an in-flight connection after explicit disconnect', async () => {
    let finish!: (address: string) => void;
    wallet.requestAccess.mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
    const pending = useWallet.getState().connect();
    await vi.waitFor(() => expect(wallet.requestAccess).toHaveBeenCalledOnce());
    expect(useWallet.getState().status).toBe('connecting');
    useWallet.getState().disconnect();
    finish(ADDRESS);
    await pending;
    expect(useWallet.getState()).toMatchObject({ status: 'disconnected', address: null, isConnecting: false });
  });

  it('deduplicates connection prompts while one request is active', async () => {
    let finish!: (address: string) => void;
    wallet.requestAccess.mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
    const pending = useWallet.getState().connect();
    await vi.waitFor(() => expect(wallet.requestAccess).toHaveBeenCalledOnce());
    await useWallet.getState().connect();
    expect(wallet.requestAccess).toHaveBeenCalledOnce();
    finish(ADDRESS);
    await pending;
  });

  it('drops stale signing identity when a refresh discovers a locked wallet', async () => {
    await useWallet.getState().connect();
    wallet.getNetwork.mockRejectedValue(new Error('Freighter is locked'));
    await useWallet.getState().refreshNetwork();
    expect(useWallet.getState()).toMatchObject({ status: 'locked', address: null, network: 'TESTNET' });
  });
});
