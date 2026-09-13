export const MANAS_CONFIG = {
  // Conversion
  USD_TO_MANAS: 100,              // 1 USD = 100 MANAS

  // Coûts
  ANIME_EPISODE_COST: 1,
  CHAPTER_COST_DEFAULT: 50,
  COLLABORATION_COST: 250,

  // Répartition
  CREATOR_SHARE: 0.7,              // 70 % au créateur
  PLATFORM_SHARE: 0.3,             // 30 % plateforme

  // Gains
  DAILY_ACTION_REWARD: 1,
  DAILY_MAX_ACTIONS: 10,

  // Transferts
  SEND_FEE_PERCENT: 0,             // 0 % (à ajuster)
  SEND_MAX_AMOUNT: 1_000_000,      // plafond

  // Collaboration
  COLLABORATION_REFUND_ON_REJECT: true,
  COLLABORATION_REQUEST_TTL_DAYS: 7,
};
