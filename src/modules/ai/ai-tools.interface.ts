// src/modules/ai/interfaces/ai-tools.interface.ts

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
  confidence: number; // 0-1
  suggestedBanDuration?: '1d' | '7d' | '30d' | 'permanent';
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