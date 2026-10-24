import { HelpArticle } from '../types'

export const demoModeArticle: HelpArticle = {
  slug: 'demo-mode',
  title: 'Exploring Disciplr in demo mode',
  category: 'Vaults',
  summary: 'Test vault creation, simulated verification, and penalty triggers without spending real crypto.',
  keywords: ['demo', 'mode', 'simulation', 'test', 'sandbox', 'mock'],
  body: `Demo mode provides a safe playground for testing Disciplr's commitment mechanics and workflows without connecting a funded wallet or risking real assets.

### Features Available in Demo Mode
- **Instant Mock Wallets**: Experience Disciplr with pre-populated dummy balances of XLM and USDC.
- **Fast-Forward Milestones**: Simulate vault progress and deadline triggers in accelerated time.
- **Verifier Emulation**: Test how proof submission and verifier approvals flow from both perspectives.

### How to Toggle Demo Mode
1. Click the profile or network indicator in the top navigation header.
2. Toggle the **Demo Mode** switch on.
3. You will see an amber badge indicating you are in test mode.

All actions taken while Demo Mode is active are simulated locally and do not interact with the live Stellar blockchain.`,
  related: ['creating-a-vault', 'how-verification-works', 'exporting-deadlines-calendar'],
  updatedAt: '2026-03-15',
}
