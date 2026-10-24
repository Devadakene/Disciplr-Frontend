import { HelpArticle } from '../types'

export const whatHappensOnFailureArticle: HelpArticle = {
  slug: 'what-happens-on-failure',
  title: 'What happens when a vault fails or expires',
  category: 'Vaults',
  summary: 'Detailed breakdown of smart contract execution, penalty dispersal, and dispute resolution if milestones lapse.',
  keywords: ['failure', 'expires', 'penalty', 'forfeit', 'deadline', 'dispute'],
  body: `Accountability on Disciplr is enforced cryptographically. If a milestone is missed or the verifier rejects the proof, failure rules are initiated.

### Expiration Trigger
Once the deadline passes without an approved verification transaction:
- The vault enters an **Expired / Failed** status.
- The smart contract disallows further proof submissions.
- Anyone can trigger the permissionless payout transaction that releases funds to the failure destination.

### Dispersal of Locked Assets
Funds are immediately transferred according to the rules set during vault creation:
- **Burn**: Tokens are routed to the unspendable burn address.
- **Charity**: Tokens arrive at the public good organization address specified in the vault config.
- **Counter-party / Referee**: Staked capital is delivered to your appointed accountability partner.

### Can a Failed Vault Be Reversed?
No. Once locked on Stellar's ledger, neither Disciplr administrators nor users can alter contract terms or recover forfeited collateral. This guarantee provides true accountability.`,
  related: ['choosing-destinations', 'creating-a-vault', 'how-verification-works'],
  updatedAt: '2026-03-15',
}
