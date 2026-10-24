import { HelpArticle } from '../types'
import { creatingAVaultArticle } from './creating-a-vault'
import { choosingDestinationsArticle } from './choosing-destinations'
import { howVerificationWorksArticle } from './how-verification-works'
import { networkMismatchBannerArticle } from './the-network-mismatch-banner'
import { usdcTrustlinesArticle } from './usdc-trustlines'
import { demoModeArticle } from './demo-mode'
import { exportingDeadlinesCalendarArticle } from './exporting-deadlines-calendar'
import { whatHappensOnFailureArticle } from './what-happens-on-failure'

export const articles: HelpArticle[] = [
  creatingAVaultArticle,
  choosingDestinationsArticle,
  howVerificationWorksArticle,
  networkMismatchBannerArticle,
  usdcTrustlinesArticle,
  demoModeArticle,
  exportingDeadlinesCalendarArticle,
  whatHappensOnFailureArticle,
]

export const articleMap: Record<string, HelpArticle> = Object.fromEntries(
  articles.map((article) => [article.slug, article]),
)

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return articleMap[slug]
}
