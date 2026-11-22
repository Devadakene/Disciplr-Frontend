import { Link, useNavigate } from 'react-router-dom'
import { Text } from '../components/Text'
import { WalletConnectButton } from '../components/Wallet/WalletConnectButton'
import { Zap } from 'lucide-react'
import { VaultIcon, MilestoneIcon, TimeLockIcon, TreasuryIcon } from '../components/icons'
import { useWallet } from '../context/WalletContext'
import { useT, type MessageKey } from '../i18n'

/**
 * Home page invariants:
 * - The page is a pure presentational component: it must never throw during render,
 *   regardless of auth / wallet state. All navigation links are static and
 *   deterministic.
 * - The hero must always expose exactly one H1 and one primary CTA targeting
 *   /vaults/create so the entry point is discoverable and accessible.
 * - Wallet connection failures are isolated to the WalletConnectButton and
 *   must not cascade into the rest of the page.
 */

const PRIMARY_CTA_PATH = '/vaults/create'
const SECONDARY_LINKS: ReadonlyArray<{ labelKey: MessageKey; to: string }> = [
  { labelKey: 'home.hero.dashboardLink', to: '/dashboard' },
  { labelKey: 'home.hero.myVaultsLink', to: '/vaults' },
]

const HOW_IT_WORKS: ReadonlyArray<{
  icon: typeof Zap | typeof TimeLockIcon | typeof MilestoneIcon
  titleKey: MessageKey
  bodyKey: MessageKey
}> = [
  {
    icon: Zap,
    titleKey: 'home.howItWorks.step1.title',
    bodyKey: 'home.howItWorks.step1.body',
  },
  {
    icon: TimeLockIcon,
    titleKey: 'home.howItWorks.step2.title',
    bodyKey: 'home.howItWorks.step2.body',
  },
  {
    icon: MilestoneIcon,
    titleKey: 'home.howItWorks.step3.title',
    bodyKey: 'home.howItWorks.step3.body',
  },
]

const TRUST_SIGNALS: ReadonlyArray<{
  icon: typeof VaultIcon | typeof TimeLockIcon | typeof TreasuryIcon
  labelKey: MessageKey
}> = [
  { icon: VaultIcon, labelKey: 'home.trust.audited' },
  { icon: TimeLockIcon, labelKey: 'home.trust.nonCustodial' },
  { icon: TreasuryIcon, labelKey: 'home.trust.instantSettlements' },
]

export default function Home() {
  const { connectDemo } = useWallet()
  const navigate = useNavigate()
  const t = useT()

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--spacing-4)' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', marginBottom: '3rem', paddingTop: 'var(--spacing-8)' }}>
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <VaultIcon size={64} style={{ color: 'var(--accent)', marginBottom: 'var(--spacing-4)' }} />
        </div>
        <Text role="display" as="h1" style={{ marginBottom: 'var(--spacing-4)', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
          {t('home.hero.title')}
        </Text>
        <Text role="body" as="p" style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-8)', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', fontSize: '1.125rem' }}>
          {t('home.hero.subtitle')}
        </Text>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-4)', flexWrap: 'wrap', marginBottom: 'var(--spacing-4)' }}>
          <Link
            to={PRIMARY_CTA_PATH}
            style={{
              backgroundColor: 'var(--accent)',
              color: 'white',
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {t('home.hero.primaryCta')}
          </Link>
          <button
            type="button"
            onClick={() => {
              connectDemo?.();
              navigate('/dashboard');
            }}
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--font-size-body)',
            }}
          >
            {t('home.hero.demoCta')}
          </button>
          {SECONDARY_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 'var(--font-size-body)',
              }}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section style={{ marginBottom: '3rem' }}>
        <Text role="title" as="h2" style={{ textAlign: 'center', marginBottom: 'var(--spacing-8)' }}>
          {t('home.howItWorks.title')}
        </Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-6)' }}>
          {HOW_IT_WORKS.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.titleKey}
                style={{ textAlign: 'center', padding: 'var(--spacing-6)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
              >
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <Icon size={32} style={{ color: 'var(--accent)' }} />
                </div>
                <Text role="subtitle" as="h3" style={{ marginBottom: 'var(--spacing-2)' }}>
                  {t(step.titleKey)}
                </Text>
                <Text role="body" as="p" style={{ color: 'var(--muted)' }}>
                  {t(step.bodyKey)}
                </Text>
              </div>
            )
          })}
        </div>
      </section>

      {/* Stellar/Soroban Context */}
      <section style={{ marginBottom: '3rem', padding: 'var(--spacing-8)', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
        <Text role="title" as="h2" style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
          {t('home.stellar.title')}
        </Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-6)' }}>
          <div>
            <Text role="subtitle" as="h3" style={{ marginBottom: 'var(--spacing-2)' }}>
              {t('home.stellar.whyStellarTitle')}
            </Text>
            <Text role="body" as="p" style={{ color: 'var(--muted)' }}>
              {t('home.stellar.whyStellarBody')}
            </Text>
          </div>
          <div>
            <Text role="subtitle" as="h3" style={{ marginBottom: 'var(--spacing-2)' }}>
              {t('home.stellar.whySorobanTitle')}
            </Text>
            <Text role="body" as="p" style={{ color: 'var(--muted)' }}>
              {t('home.stellar.whySorobanBody')}
            </Text>
          </div>
        </div>
        <details open={false} style={{ marginTop: 'var(--spacing-4)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--accent)' }}>
            {t('home.stellar.learnMoreSummary')}
          </summary>
          <Text role="body" as="p" style={{ marginTop: 'var(--spacing-2)', color: 'var(--muted)' }}>
            {t('home.stellar.learnMoreBody')}
          </Text>
        </details>
      </section>

      {/* Trust/Social Proof */}
      <section style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <Text role="title" as="h2" style={{ marginBottom: 'var(--spacing-6)' }}>
          {t('home.trust.title')}
        </Text>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-8)', flexWrap: 'wrap', marginBottom: 'var(--spacing-4)' }}>
          {TRUST_SIGNALS.map((signal) => {
            const Icon = signal.icon
            return (
              <div
                key={signal.labelKey}
                style={{ padding: 'var(--spacing-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
              >
                <Icon size={24} style={{ color: 'var(--success)' }} />
                <Text role="body" as="p" style={{ marginTop: 'var(--spacing-2)' }}>
                  {t(signal.labelKey)}
                </Text>
              </div>
            )
          })}
        </div>
        <Text role="body" as="p" style={{ color: 'var(--muted)', maxWidth: '600px', margin: '0 auto' }}>
          {t('home.trust.footnote')}
        </Text>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', padding: 'var(--spacing-8)', background: 'var(--accent)', color: 'white', borderRadius: 'var(--radius)' }}>
        <Text role="title" as="h2" style={{ marginBottom: 'var(--spacing-4)', color: 'white' }}>
          {t('home.finalCta.title')}
        </Text>
        <Text role="body" as="p" style={{ marginBottom: 'var(--spacing-6)', opacity: 0.9 }}>
          {t('home.finalCta.subtitle')}
        </Text>
        <WalletConnectButton />
      </section>
    </div>
  )
}
