import { HelpArticle } from '../types'

export const creatingAVaultArticle: HelpArticle = {
  slug: 'creating-a-vault',
  title: 'Creating a vault in Disciplr',
  category: 'Vaults',
  summary: 'Learn how to set a target deposit amount, configure challenge duration, and lock commitments.',
  keywords: ['create', 'vault', 'steps', 'target', 'duration', 'deposit'],
  body: `Creating a vault in Disciplr lets you lock funds against a personal or team milestone with enforceable accountability on Stellar.

### 1. Connect Your Stellar Wallet
Before creating a vault, ensure your Stellar wallet (such as Freighter) is connected to Disciplr and configured to the correct network.

### 2. Configure Vault Parameters
Navigate to the Create Vault page and specify:
- **Vault Name**: A descriptive label for your commitment goal.
- **Target Deposit**: The total amount of USDC or XLM you commit to staking.
- **Deadline**: The exact timestamp before which verification must be completed.
- **Verifier**: The designated verifier address or service assigned to validate proof.

### 3. Review and Sign
Check the summary of your success and failure destinations. Once you sign the setup transaction with your wallet, the smart contract locks the vault terms on-chain.`,
  related: ['choosing-destinations', 'how-verification-works', 'what-happens-on-failure'],
  updatedAt: '2026-03-15',
}
