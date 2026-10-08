# Freighter connection state

The dashboard uses one Zustand `useWallet` store for desktop and mobile
navigation, route access, administrator actions and investor transfers.
`WalletConnection` is the reusable connection control. Feature code may read
`status`, `address`, and `network`; existing `isConnecting` and
`connectionError` consumers remain compatible.

| State | Meaning and recovery |
| --- | --- |
| `disconnected` | No wallet session. Connect when ready. |
| `connecting` | An explicit Freighter request is active. Duplicate prompts are blocked. |
| `connected` | A key and network were read, and the network matches dashboard configuration. |
| `wrong_network` | A key was read on another network. Switch Freighter networks; existing app and signing guards block mismatched actions. |
| `locked` | Freighter returned an empty key or a locked-wallet error. Unlock and reconnect. |
| `rejected` | The user declined or cancelled access. Retry is an explicit user choice. |
| `unavailable` | The extension is not installed or enabled. Enable it and reconnect. |
| `error` | The wallet or its network could not be read. Retry connection; no signing identity is exposed. |

The pinned Freighter API is v2: connectivity/access methods return booleans,
and key/network methods return strings. Network-object normalization remains
compatible with existing fixtures. Auto-reconnection checks `isAllowed` and
reads a previously permitted key without calling `requestAccess`, so loading
a page never opens an approval popup. It does not override a newer explicit
connection or a disconnect.

Asynchronous results carry a connection generation. Disconnect immediately
clears identity and invalidates outstanding extension requests. A network-read
failure also clears signing identity while retaining the last observed network
for diagnostics. Unknown networks never produce a `connected` state. Error
messages come from a fixed map rather than extension/provider error strings.

The app's existing network watcher updates the state after a network switch.
Existing admin and investor components continue to consume this same store;
there is no second wallet context or independently connected signer.
These states describe extension/session availability and protocol network
matching. They do not grant an on-chain role or determine investor eligibility.

Focused coverage: `src/hooks/useWallet.test.ts`,
`src/features/wallet/components/WalletConnection.test.tsx`, and the existing
`src/features/wallet/useNetworkGuard.test.tsx` regression file. Fixtures use
synthetic public addresses and mocked extension responses; no secret keys or
live signing are needed.
