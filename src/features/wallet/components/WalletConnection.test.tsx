import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '@/hooks/useWallet';
import WalletConnection from './WalletConnection';

afterEach(() => useWallet.getState().disconnect());

describe('shared WalletConnection', () => {
  it('announces distinct failures and disables repeated connection actions', () => {
    useWallet.setState({ status: 'rejected', address: null, isConnecting: false });
    render(<WalletConnection />);
    expect(screen.getByRole('alert')).toHaveTextContent('declined');
    act(() => useWallet.setState({ status: 'connecting', isConnecting: true }));
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Freighter');
  });

  it('disconnects the common admin/investor identity and invokes the mobile close callback', () => {
    const onAction = vi.fn();
    useWallet.setState({ status: 'connected', address: 'GSHAREDADDRESS', network: 'TESTNET', isConnecting: false });
    render(<WalletConnection onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /Disconnect/ }));
    expect(useWallet.getState().status).toBe('disconnected');
    expect(useWallet.getState().address).toBeNull();
    expect(onAction).toHaveBeenCalledOnce();
  });
});
