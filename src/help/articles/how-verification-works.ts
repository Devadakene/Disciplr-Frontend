import { HelpArticle } from '../types'

export const howVerificationWorksArticle: HelpArticle = {
  slug: 'how-verification-works',
  title: 'How verification works in Disciplr',
  category: 'Verifier',
  summary: 'Understand proof submission, referee queues, and cryptographic confirmation of goal completion.',
  keywords: ['verifier', 'verification', 'proof', 'queue', 'referee', 'validate'],
  body: `Disciplr uses an on-chain verification model to guarantee that goals are met fairly without unilateral control.

### 1. Submitting Proof
Once your goal is reached, submit evidence through the vault detail page. Proof can include:
- API attestation links (e.g., GitHub PRs, Strava activities, WakaTime logs)
- Cryptographic hash references
- Supporting documentation uploads

### 2. Verifier Queue
Designated verifiers monitor their pending queue at \`/verifier/queue\`. They review the evidence against the objective criteria established at vault creation.

### 3. Signing the Attestation
When the verifier approves the submission:
- The verifier signs an attestation transaction.
- The smart contract verifies the verifier's signature.
- Funds immediately unlock and route to your specified success destination.`,
  related: ['creating-a-vault', 'choosing-destinations', 'what-happens-on-failure'],
  updatedAt: '2026-03-15',
}
