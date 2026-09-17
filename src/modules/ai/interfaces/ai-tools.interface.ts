// src/modules/ai/interfaces/ai-tools.interface.ts

// ============================================
// TYPES DE MODÉRATION (existants)
// ============================================

export enum ToolType {
  BAN_USER = 'banUser',
  DELETE_COMMENT = 'deleteComment',
  WARN_USER = 'warnUser',
  GET_USER_PROFILE = 'getUserProfile',
  GET_USER_COMMENTS = 'getUserComments',
  GET_REPORTED_CONTENT = 'getReportedContent',
  INSPECT_FILE = 'inspectFile',
  ANALYZE_CODE = 'analyzeCode',
  SEND_EMAIL_ALERT = 'sendEmailAlert',
}

export enum ModerationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ModerationAction {
  APPROVE = 'approve',
  WARN = 'warn',
  DELETE = 'delete',
  BAN = 'ban',
  REPORT = 'report',
}

export interface ToolCall {
  id: string;
  type: ToolType;
  parameters: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ModerationResult {
  action: ModerationAction;
  severity: ModerationSeverity;
  reason: string;
  confidence: number;
  requiresHumanReview: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: string;
  isCertified: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  createdAt: Date;
  commentsCount: number;
  warningsCount: number;
  reportsCount: number;
}

export interface CommentToModerate {
  id: string;
  content: string;
  userId: string;
  mangaId: string;
  chapterId?: string;
  createdAt: Date;
  username: string;
  userRole: string;
  userIsCertified: boolean;
  userPreviousWarnings: number;
  userPreviousBans: number;
}

export interface EmailAlertData {
  to: string;
  subject: string;
  problem: string;
  details: string;
  files?: string[];
  suggestedFix?: string;
  urgency: ModerationSeverity;
  timestamp: Date;
}

// ============================================
// ✅ NOUVEAU — TYPES OZYRA (FUNCTION CALLING)
// ============================================

/**
 * Noms des fonctions qu'OZYRA peut appeler.
 * Doivent correspondre EXACTEMENT aux noms déclarés dans les tools Groq/OpenAI.
 */
export enum OzyraToolName {
  SEARCH_MANGA = 'search_manga',
  GET_TOP_MANGAS = 'get_top_mangas',
  GET_TOP_CREATORS = 'get_top_creators',
  GET_MANGA_DETAILS = 'get_manga_details',
  GET_USER_BALANCE = 'get_user_balance',
  GET_USER_TICKETS = 'get_user_tickets',
  GET_USER_MANGAS = 'get_user_mangas',
  GET_PREMIUM_INFO = 'get_premium_info',
}

/**
 * Appel de fonction émis par le LLM.
 * Format compatible Groq / OpenAI.
 */
export interface OzyraToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON stringifié
  };
}

/**
 * Résultat d'une fonction exécutée.
 * Renvoyé au LLM sous forme de message "tool".
 */
export interface OzyraToolResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Contexte utilisateur injecté dans le prompt et dans les fonctions.
 * ⚠️ Le userId est TOUJOURS récupéré depuis le JWT, JAMAIS depuis le LLM.
 */
export interface OzyraContext {
  userId: string;
  username: string;
  role: string; // READER | CREATOR | ADMIN
  premiumActive: boolean;
  premiumPlan: string | null;
  premiumExpires: Date | null;
  manas: number;
  tickets: number;
  isCertified: boolean;
}

/**
 * Résumé d'un tool utilisé pendant une conversation.
 */
export interface OzyraToolUsage {
  name: string;
  success: boolean;
  summary?: string;
}

/**
 * Réponse finale d'OZYRA.
 */
export interface OzyraChatResponse {
  success: boolean;
  reply: string;
  toolsUsed?: OzyraToolUsage[];
  provider?: string;
  error?: string;
}

/**
 * Définition d'un tool au format Groq / OpenAI.
 */
export interface OzyraToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Période de classement pour les fonctions "top".
 */
export type OzyraPeriod = 'day' | 'week' | 'month' | 'all';
