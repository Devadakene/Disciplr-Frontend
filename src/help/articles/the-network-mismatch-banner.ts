import { HelpArticle } from '../types'

export const networkMismatchBannerArticle: HelpArticle = {
  slug: 'the-network-mismatch-banner',
  title: 'Resolving the network mismatch banner',
  category: 'Wallets',
  summary: 'Fix RPC and chain ID discrepancies between your wallet extension and Disciplr.',
  keywords: ['network', 'mismatch', 'banner', 'wallet', 'stellar', 'testnet', 'mainnet', 'freighter'],
  body: `If you see a prominent warning banner stating "Network Mismatch", your connected Stellar wallet is operating on a different network than Disciplr expects.

### Why Does This Happen?
Disciplr communicates with Soroban smart contracts deployed to a specific network (e.g., Stellar Testnet or Stellar Mainnet). If Freighter or your chosen wallet is configured to another network:
- Transactions cannot be simulated or submitted properly.
- Account balances and trustlines will reflect incorrect figures.
- Vault actions will be disabled to protect your assets.

### How to Fix It
1. Open your Stellar wallet extension (such as Freighter).
2. Click the Network selector at the top of the extension popup.
3. Switch your network to match Disciplr (typically **Testnet** or **Public / Mainnet** as indicated in the banner).
4. Refresh Disciplr or re-connect your wallet. The banner will automatically dismiss once synced.`,
  related: ['usdc-trustlines', 'demo-mode', 'creating-a-vault'],
  updatedAt: '2026-03-15',
}
