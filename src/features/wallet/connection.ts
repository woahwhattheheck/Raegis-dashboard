import { evaluateEnvironmentMismatch } from '@/lib/environment';

export type WalletConnectionStatus =
  | 'disconnected' | 'connecting' | 'connected' | 'wrong_network'
  | 'locked' | 'rejected' | 'unavailable' | 'error';

export interface WalletConnectionSnapshot {
  status: WalletConnectionStatus;
  address: string | null;
  network: string | null;
  connectionError: string | null;
}

export const WALLET_CONNECTION_MESSAGES: Record<WalletConnectionStatus, string> = {
  disconnected: 'Connect Freighter to continue.',
  connecting: 'Waiting for Freighter…',
  connected: 'Wallet connected.',
  wrong_network: 'Switch Freighter to the dashboard network before signing.',
  locked: 'Unlock Freighter, then connect again.',
  rejected: 'Connection request declined. You can try again when ready.',
  unavailable: 'Freighter is unavailable. Install or enable the extension, then try again.',
  error: 'Could not read your wallet. Please try connecting again.',
};

export function disconnectedWallet(status: WalletConnectionStatus = 'disconnected'): WalletConnectionSnapshot {
  return {
    status, address: null, network: null,
    connectionError: status === 'disconnected' || status === 'connecting'
      ? null : WALLET_CONNECTION_MESSAGES[status],
  };
}

/** Only error classification leaves the transport boundary; raw errors stay private. */
export function classifyWalletError(error: unknown): 'locked' | 'rejected' | 'error' {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const message = typeof error === 'string' ? error
    : error instanceof Error ? error.message
    : typeof record?.message === 'string' ? record.message : '';
  if (record?.code === 4001 || /reject|declin|denied|cancel/i.test(message)) return 'rejected';
  if (/locked|unlock/i.test(message)) return 'locked';
  return 'error';
}

export function connectedWallet(address: string, network: string | null): WalletConnectionSnapshot {
  const result = evaluateEnvironmentMismatch(network, true);
  if (!network || result.state === 'checking') return disconnectedWallet('error');
  const status = result.state === 'mismatch' ? 'wrong_network' : 'connected';
  return {
    status, address, network,
    connectionError: status === 'wrong_network' ? WALLET_CONNECTION_MESSAGES.wrong_network : null,
  };
}
