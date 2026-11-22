/**
 * Canonical English message catalog.
 *
 * Every translation key in the application is derived from this object.
 * Referencing a key not present here fails TypeScript type-checking.
 *
 * Conventions:
 * - Interpolation: `{name}` placeholders replaced from params.
 * - Plurals: `singular|plural` paired with a numeric `{count}` param.
 */
export const en = {
  // Language selector
  'i18n.selectLanguage': 'Language',

  // Layout — navigation & header
  'nav.skipToMain': 'Skip to main content',
  'nav.brandAria': 'Disciplr home',
  'nav.mainAria': 'Main navigation',
  'nav.openMenu': 'Open navigation menu',
  'nav.home': 'Home',
  'nav.dashboard': 'Dashboard',
  'nav.vaults': 'Vaults',
  'nav.verifier': 'Verifier',
  'nav.analytics': 'Analytics',
  'nav.docs': 'Docs',
  'nav.help': 'Help',
  'nav.transactions': 'Transactions',
  'nav.createVault': 'Create Vault',

  // Layout — footer
  'footer.github': 'GitHub',
  'footer.liveDemo': 'Live demo',
  'footer.docs': 'Docs',

  // Home page
  'home.hero.title': 'Secure Time\u2011Locked Capital Vaults on Stellar',
  'home.hero.subtitle':
    'Time\u2011locked capital vaults on Stellar that release on validation or redirect on failure.',
  'home.hero.primaryCta': 'Create Your First Vault',
  'home.hero.demoCta': 'Try the demo account',
  'home.hero.dashboardLink': 'Dashboard',
  'home.hero.myVaultsLink': 'My Vaults',
  'home.howItWorks.title': 'How It Works',
  'home.howItWorks.step1.title': '1. Connect Your Wallet',
  'home.howItWorks.step1.body':
    'Link your Stellar wallet securely to get started.',
  'home.howItWorks.step2.title': '2. Create a Vault',
  'home.howItWorks.step2.body':
    'Deposit USDC and set your success milestones.',
  'home.howItWorks.step3.title': '3. Achieve or Redirect',
  'home.howItWorks.step3.body':
    'Funds release on success or redirect automatically.',
  'home.stellar.title': 'Built on Stellar & Soroban',
  'home.stellar.whyStellarTitle': 'Why Stellar?',
  'home.stellar.whyStellarBody':
    'Fast, low-cost transactions enable global, borderless finance. Trusted by millions for secure asset transfers.',
  'home.stellar.whySorobanTitle': 'Why Soroban?',
  'home.stellar.whySorobanBody':
    'Smart contracts bring programmability to money. Automate complex financial agreements with rock-solid security.',
  'home.stellar.learnMoreSummary': 'Learn more about Stellar and Soroban',
  'home.stellar.learnMoreBody':
    'Stellar is a decentralized network for fast, low-cost cross-border payments. Soroban extends it with smart contract capabilities, making it ideal for programmable finance like Disciplr.',
  'home.trust.title': 'Trusted & Secure',
  'home.trust.audited': 'Audited Smart Contracts',
  'home.trust.nonCustodial': 'Non-Custodial',
  'home.trust.instantSettlements': 'Instant Settlements',
  'home.trust.footnote':
    "Disciplr leverages Stellar's proven infrastructure, used by organizations worldwide for secure financial operations.",
  'home.finalCta.title': 'Ready to Secure Your Future?',
  'home.finalCta.subtitle':
    'Join thousands building unstoppable financial discipline.',

  // Dashboard page
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'Your vault overview at a glance.',
  'dashboard.connectPrompt.title': 'Connect your wallet to see your vaults',
  'dashboard.connectPrompt.body':
    'Your vaults, activity and deadlines appear here once a wallet is connected.',
  'dashboard.connectPrompt.cta': 'Connect wallet',
  'dashboard.summary.totalLocked': 'Total Locked',
  'dashboard.summary.activeVaults': 'Active Vaults',
  'dashboard.summary.pendingMilestones': 'Pending Milestones',
  'dashboard.summary.completionRate': 'Completion Rate',
  'dashboard.summary.allTime': 'all time',
  'dashboard.actions.createVault': '+ Create Vault',
  'dashboard.actions.viewAllVaults': 'View All Vaults',
  'dashboard.actions.verifyMilestone': 'Verify Milestone',
  'dashboard.atRisk.title': '⚠️ At Risk ({count})',
  'dashboard.atRisk.description':
    'These vaults need immediate attention — their deadlines are approaching or critical.',
  'dashboard.yourVaults.title': 'Your vaults',
  'dashboard.yourVaults.viewAll': 'View all →',
  'dashboard.yourVaults.loading': 'Loading vaults…',
  'dashboard.yourVaults.error': 'Failed to load vaults.',
  'dashboard.yourVaults.retry': 'Retry',
  'dashboard.yourVaults.emptyTitle': 'No vaults yet',
  'dashboard.yourVaults.emptyBody':
    'Create your first vault to start locking capital.',
  'dashboard.yourVaults.emptyCta': 'Create Vault',
  'dashboard.yourVaults.unverifiedCount':
    '{count} vault could not be verified and is not shown.|{count} vaults could not be verified and are not shown.',
  'dashboard.recentActivity.title': 'Recent Activity',
  'dashboard.successRate.title': 'Success Rate',
  'dashboard.successRate.lastSixMonths': 'Last 6 months',

  // Vaults page
  'vaults.title': 'Vaults',
  'vaults.subtitle': 'Explore, track, and manage capital lockup vaults.',
  'vaults.createCta': 'Create Vault',
  'vaults.scope.all': 'All Vaults',
  'vaults.scope.mine': 'Created by me',
  'vaults.scope.verifying': 'Verifying',
  'vaults.search.label': 'Search vaults',
  'vaults.search.placeholder': 'Search by name or id…',
  'vaults.search.ariaLabel': 'Search vaults by name or id',
  'vaults.sort.label': 'Sort:',
  'vaults.sort.ariaLabel': 'Sort vaults',
  'vaults.sort.newest': 'Newest first',
  'vaults.sort.oldest': 'Oldest first',
  'vaults.sort.deadlineSoonest': 'Deadline (soonest)',
  'vaults.sort.deadlineLatest': 'Deadline (latest)',
  'vaults.sort.amountHighToLow': 'Amount (high to low)',
  'vaults.sort.amountLowToHigh': 'Amount (low to high)',
  'vaults.status.tablistAria': 'Filter vaults by status',
  'vaults.status.all': 'All',
  'vaults.status.active': 'Active',
  'vaults.status.pending_validation': 'Pending Validation',
  'vaults.status.completed': 'Completed',
  'vaults.status.failed': 'Failed',
  'vaults.status.cancelled': 'Cancelled',
  'vaults.loading': 'Loading vaults...',
  'vaults.retry': 'Retry',
  'vaults.empty.message': 'No vaults found matching your filters.',
  'vaults.empty.cta': 'Create a new vault',
  'vaults.paginationAria': 'Vaults pagination',
} as const;
