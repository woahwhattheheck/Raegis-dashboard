import { useWallet } from '@/hooks/useWallet';
import { truncateAddress } from '@/utils/formatting';
import { WALLET_CONNECTION_MESSAGES } from '../connection';

/** Shared by desktop/mobile navigation and available to admin/investor flows. */
export default function WalletConnection({ onAction }: { onAction?: () => void }) {
  const { status, address, isConnecting, connect, disconnect } = useWallet();
  const failed = ['locked', 'rejected', 'unavailable', 'error', 'wrong_network'].includes(status);
  return (
    <div className="flex flex-col items-start gap-2" data-wallet-state={status}>
      <button
        type="button"
        disabled={isConnecting}
        onClick={() => {
          if (address) disconnect();
          else void connect();
          onAction?.();
        }}
        className="bg-aegis-brand hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm transition disabled:opacity-50"
      >
        {address ? `Disconnect ${truncateAddress(address)}`
          : isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      <span role={failed ? 'alert' : 'status'} className={`max-w-xs text-xs ${failed ? 'text-red-700' : 'text-slate-600'}`}>
        {WALLET_CONNECTION_MESSAGES[status]}
      </span>
    </div>
  );
}
