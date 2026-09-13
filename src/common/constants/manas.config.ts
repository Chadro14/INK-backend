export const MANAS_CONFIG = {
  // ============================================
  // CONVERSION
  // ============================================
  USD_TO_MANAS: 100, // 1 USD = 100 MANAS

  // ============================================
  // COÛTS
  // ============================================
  ANIME_EPISODE_COST: 1,
  CHAPTER_COST_DEFAULT: 50,
  COLLABORATION_COST: 250,

  // ============================================
  // RÉPARTITION
  // ============================================
  CREATOR_SHARE: 0.7, // 70 % au créateur
  PLATFORM_SHARE: 0.3, // 30 % plateforme

  // ============================================
  // GAINS QUOTIDIENS
  // ============================================
  DAILY_ACTION_REWARD: 1,
  DAILY_MAX_ACTIONS: 10,

  // ============================================
  // TRANSFERTS ENTRE UTILISATEURS
  // ============================================
  SEND_FEE_PERCENT: 0, // 0 % (à ajuster plus tard)
  SEND_MAX_AMOUNT: 1_000_000, // plafond par envoi

  // ============================================
  // COLLABORATION
  // ============================================
  COLLABORATION_REFUND_ON_REJECT: true,
  COLLABORATION_REQUEST_TTL_DAYS: 7,
} as const;

export type ManasConfig = typeof MANAS_CONFIG;
