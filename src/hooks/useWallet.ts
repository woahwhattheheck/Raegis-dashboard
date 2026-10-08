import { create } from 'zustand';
import { isConnected, isAllowed, requestAccess, getPublicKey, getNetwork } from '@stellar/freighter-api';
import { toStoredNetwork } from '@/lib/environment';
import {
  classifyWalletError, connectedWallet, disconnectedWallet,
  type WalletConnectionSnapshot,
} from '@/features/wallet/connection';

export interface WalletState extends WalletConnectionSnapshot {
  /** Compatibility alias for existing signing and navigation consumers. */
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  tryAutoReconnect: () => Promise<void>;
  refreshNetwork: () => Promise<void>;
}

/** Cancels stale extension results after disconnect or a newer connection. */
let connectionGeneration = 0;

export const useWallet = create<WalletState>((set, get) => ({
  ...disconnectedWallet(),
  isConnecting: false,

  connect: async () => {
    if (get().isConnecting) return;
    const generation = ++connectionGeneration;
    set({ ...disconnectedWallet('connecting'), isConnecting: true });
    const finish = (snapshot: WalletConnectionSnapshot) => {
      if (generation === connectionGeneration) set({ ...snapshot, isConnecting: false });
    };
    try {
      if (!(await isConnected())) {
        finish(disconnectedWallet('unavailable'));
        return;
      }
      if (generation !== connectionGeneration) return;
      const address = await requestAccess();
      if (generation !== connectionGeneration) return;
      if (!address) {
        finish(disconnectedWallet('locked'));
        return;
      }
      finish(connectedWallet(address, toStoredNetwork(await getNetwork())));
    } catch (error) {
      finish(disconnectedWallet(classifyWalletError(error)));
    }
  },

  /** Restore only previously allowed access; never opens an approval popup. */
  tryAutoReconnect: async () => {
    if (get().status !== 'disconnected' || get().address) return;
    const generation = ++connectionGeneration;
    const finish = (snapshot: WalletConnectionSnapshot) => {
      if (generation === connectionGeneration) set({ ...snapshot, isConnecting: false });
    };
    try {
      if (!(await isConnected())) {
        finish(disconnectedWallet('unavailable'));
        return;
      }
      if (generation !== connectionGeneration || !(await isAllowed())) return;
      if (generation !== connectionGeneration) return;
      const address = await getPublicKey();
      if (generation !== connectionGeneration) return;
      if (!address) {
        finish(disconnectedWallet('locked'));
        return;
      }
      finish(connectedWallet(address, toStoredNetwork(await getNetwork())));
    } catch (error) {
      finish(disconnectedWallet(classifyWalletError(error)));
    }
  },

  refreshNetwork: async () => {
    const address = get().address;
    if (!address || get().isConnecting) return;
    const generation = connectionGeneration;
    try {
      const next = toStoredNetwork(await getNetwork());
      if (generation !== connectionGeneration || get().address !== address) return;
      const snapshot = connectedWallet(address, next);
      if (snapshot.network !== get().network || snapshot.status !== get().status) set(snapshot);
    } catch (error) {
      if (generation !== connectionGeneration || get().address !== address) return;
      // Retain observed network for diagnostics; remove stale signing identity.
      set({ ...disconnectedWallet(classifyWalletError(error)), network: get().network });
    }
  },

  disconnect: () => {
    ++connectionGeneration;
    set({ ...disconnectedWallet(), isConnecting: false });
  },
}));
