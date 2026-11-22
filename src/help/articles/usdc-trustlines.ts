import { HelpArticle } from '../types'

export const usdcTrustlinesArticle: HelpArticle = {
  slug: 'usdc-trustlines',
  title: 'Setting up USDC trustlines on Stellar',
  category: 'Wallets',
  summary: 'How to establish trustlines for Circle USDC to hold and stake stablecoins on Disciplr.',
  keywords: ['usdc', 'trustlines', 'stellar', 'assets', 'token', 'circle', 'balance'],
  body: `On Stellar, accounts cannot receive or hold tokens other than native XLM without first establishing an explicit trustline.

### What is a Trustline?
A trustline is an on-chain declaration that your account agrees to hold a specific asset issued by a trusted issuer account. For USDC, this is Circle's authorized issuer address.

### Adding a USDC Trustline
1. Open your Stellar wallet (e.g. Freighter, Lobstr).
2. Go to **Assets** or **Add Asset**.
3. Search for **USDC** and ensure the issuer matches Circle's verified anchor address.
4. Confirm and sign the transaction. Note that establishing a trustline requires a small base reserve of 0.5 XLM in your account.

Once added, your USDC balance will appear on Disciplr and you will be able to lock USDC stakes into vaults.`,
  related: ['the-network-mismatch-banner', 'creating-a-vault', 'demo-mode'],
  updatedAt: '2026-03-15',
}
