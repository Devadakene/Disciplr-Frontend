import { HelpArticle } from '../types'

export const choosingDestinationsArticle: HelpArticle = {
  slug: 'choosing-destinations',
  title: 'Choosing success and failure destinations',
  category: 'Vaults',
  summary: 'Configure where staked funds go upon successful proof verification or challenge expiration.',
  keywords: ['destinations', 'success', 'failure', 'beneficiary', 'penalty', 'payout'],
  body: `When setting up a vault, you must specify clear destinations for both positive outcome and failure scenarios.

### Success Destination
If your milestone is verified before the deadline, 100% of the locked principal returns to this address.
- By default, your connected wallet address is pre-filled.
- Alternatively, you can route successful completions to a savings account or a collaborative multi-sig.

### Failure Destination
If the deadline expires without valid verification, the locked funds are disbursed according to your penalty rules.
- **Charity or Public Good**: Send funds directly to a verified nonprofit Stellar address.
- **Burn Address**: Permanently remove the staked tokens to enforce skin-in-the-game accountability.
- **Accountability Partner**: Direct forfeit funds to an accountability partner or referee.

Ensure both addresses support the asset you are staking to prevent token locks.`,
  related: ['creating-a-vault', 'what-happens-on-failure', 'how-verification-works'],
  updatedAt: '2026-03-15',
}
