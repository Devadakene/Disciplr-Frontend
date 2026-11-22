import type { PartialMessageCatalog } from './types';

/**
 * Spanish message catalog.
 *
 * Keys omitted here fall back to English (`en.ts`) with a dev-only warning.
 */
export const es: PartialMessageCatalog = {
  // Language selector
  'i18n.selectLanguage': 'Idioma',

  // Layout — navigation & header
  'nav.skipToMain': 'Ir al contenido principal',
  'nav.brandAria': 'Inicio de Disciplr',
  'nav.mainAria': 'Navegación principal',
  'nav.openMenu': 'Abrir menú de navegación',
  'nav.home': 'Inicio',
  'nav.dashboard': 'Panel',
  'nav.vaults': 'Bóvedas',
  'nav.verifier': 'Verificador',
  'nav.analytics': 'Analíticas',
  'nav.docs': 'Documentación',
  'nav.help': 'Ayuda',
  'nav.transactions': 'Transacciones',
  'nav.createVault': 'Crear Bóveda',

  // Layout — footer
  'footer.github': 'GitHub',
  'footer.liveDemo': 'Demo en vivo',
  'footer.docs': 'Documentación',

  // Home page
  'home.hero.title': 'Bóvedas de Capital con Bloqueo Temporal en Stellar',
  'home.hero.subtitle':
    'Bóvedas de capital con bloqueo temporal en Stellar que se liberan al validar o se redirigen si fallan.',
  'home.hero.primaryCta': 'Crea tu primera bóveda',
  'home.hero.demoCta': 'Probar la cuenta demo',
  'home.hero.dashboardLink': 'Panel',
  'home.hero.myVaultsLink': 'Mis Bóvedas',
  'home.howItWorks.title': 'Cómo funciona',
  'home.howItWorks.step1.title': '1. Conecta tu billetera',
  'home.howItWorks.step1.body':
    'Vincula tu billetera Stellar de forma segura para comenzar.',
  'home.howItWorks.step2.title': '2. Crea una bóveda',
  'home.howItWorks.step2.body':
    'Deposita USDC y define tus hitos de cumplimiento.',
  'home.howItWorks.step3.title': '3. Cumple o redirige',
  'home.howItWorks.step3.body':
    'Los fondos se liberan al cumplir o se redirigen automáticamente.',
  'home.stellar.title': 'Construido sobre Stellar y Soroban',
  'home.stellar.whyStellarTitle': '¿Por qué Stellar?',
  'home.stellar.whyStellarBody':
    'Transacciones rápidas y de bajo costo permiten finanzas globales sin fronteras. Millones confían en Stellar para transferencias seguras.',
  'home.stellar.whySorobanTitle': '¿Por qué Soroban?',
  'home.stellar.whySorobanBody':
    'Los contratos inteligentes aportan programabilidad al dinero. Automatiza acuerdos financieros complejos con seguridad sólida.',
  'home.stellar.learnMoreSummary': 'Más información sobre Stellar y Soroban',
  'home.stellar.learnMoreBody':
    'Stellar es una red descentralizada para pagos transfronterizos rápidos y económicos. Soroban añade contratos inteligentes, ideal para finanzas programables como Disciplr.',
  'home.trust.title': 'Confiable y Seguro',
  'home.trust.audited': 'Contratos Inteligentes Auditados',
  'home.trust.nonCustodial': 'Sin Custodia',
  'home.trust.instantSettlements': 'Liquidaciones Instantáneas',
  'home.trust.footnote':
    'Disciplr aprovecha la infraestructura probada de Stellar, utilizada por organizaciones en todo el mundo para operaciones financieras seguras.',
  'home.finalCta.title': '¿Listo para asegurar tu futuro?',
  'home.finalCta.subtitle':
    'Únete a miles construyendo disciplina financiera imparable.',

  // Dashboard page
  'dashboard.title': 'Panel',
  'dashboard.subtitle': 'Resumen de tus bóvedas de un vistazo.',
  'dashboard.connectPrompt.title': 'Conecta tu billetera para ver tus bóvedas',
  'dashboard.connectPrompt.body':
    'Tus bóvedas, actividad y fechas límite aparecerán aquí cuando conectes una billetera.',
  'dashboard.connectPrompt.cta': 'Conectar billetera',
  'dashboard.summary.totalLocked': 'Total Bloqueado',
  'dashboard.summary.activeVaults': 'Bóvedas Activas',
  'dashboard.summary.pendingMilestones': 'Hitos Pendientes',
  'dashboard.summary.completionRate': 'Tasa de Cumplimiento',
  'dashboard.summary.allTime': 'histórico',
  'dashboard.actions.createVault': '+ Crear Bóveda',
  'dashboard.actions.viewAllVaults': 'Ver todas las bóvedas',
  'dashboard.actions.verifyMilestone': 'Verificar hito',
  'dashboard.atRisk.title': '⚠️ En Riesgo ({count})',
  'dashboard.atRisk.description':
    'Estas bóvedas necesitan atención inmediata: sus fechas límite están próximas o son críticas.',
  'dashboard.yourVaults.title': 'Tus bóvedas',
  'dashboard.yourVaults.viewAll': 'Ver todas →',
  'dashboard.yourVaults.loading': 'Cargando bóvedas…',
  'dashboard.yourVaults.error': 'No se pudieron cargar las bóvedas.',
  'dashboard.yourVaults.retry': 'Reintentar',
  'dashboard.yourVaults.emptyTitle': 'Aún no hay bóvedas',
  'dashboard.yourVaults.emptyBody':
    'Crea tu primera bóveda para empezar a bloquear capital.',
  'dashboard.yourVaults.emptyCta': 'Crear Bóveda',
  'dashboard.yourVaults.unverifiedCount':
    '{count} bóveda no se pudo verificar y no se muestra.|{count} bóvedas no se pudieron verificar y no se muestran.',
  'dashboard.recentActivity.title': 'Actividad Reciente',
  'dashboard.successRate.title': 'Tasa de Éxito',
  'dashboard.successRate.lastSixMonths': 'Últimos 6 meses',

  // Vaults page
  'vaults.title': 'Bóvedas',
  'vaults.subtitle': 'Explora, sigue y gestiona bóvedas de bloqueo de capital.',
  'vaults.createCta': 'Crear Bóveda',
  'vaults.scope.all': 'Todas las bóvedas',
  'vaults.scope.mine': 'Creadas por mí',
  'vaults.scope.verifying': 'Verificando',
  'vaults.search.label': 'Buscar bóvedas',
  'vaults.search.placeholder': 'Buscar por nombre o id…',
  'vaults.search.ariaLabel': 'Buscar bóvedas por nombre o id',
  'vaults.sort.label': 'Ordenar:',
  'vaults.sort.ariaLabel': 'Ordenar bóvedas',
  'vaults.sort.newest': 'Más recientes primero',
  'vaults.sort.oldest': 'Más antiguas primero',
  'vaults.sort.deadlineSoonest': 'Fecha límite (más próxima)',
  'vaults.sort.deadlineLatest': 'Fecha límite (más lejana)',
  'vaults.sort.amountHighToLow': 'Monto (mayor a menor)',
  'vaults.sort.amountLowToHigh': 'Monto (menor a mayor)',
  'vaults.status.tablistAria': 'Filtrar bóvedas por estado',
  'vaults.status.all': 'Todas',
  'vaults.status.active': 'Activa',
  'vaults.status.pending_validation': 'Pendiente de validación',
  'vaults.status.completed': 'Completada',
  'vaults.status.failed': 'Fallida',
  'vaults.status.cancelled': 'Cancelada',
  'vaults.loading': 'Cargando bóvedas...',
  'vaults.retry': 'Reintentar',
  'vaults.empty.message': 'No se encontraron bóvedas que coincidan con tus filtros.',
  'vaults.empty.cta': 'Crear una nueva bóveda',
  'vaults.paginationAria': 'Paginación de bóvedas',
};
