export enum ScheduleExpression {
  HOURLY_ALLOCATION_AUDIT = '0 15 * * * *',
  DAILY_ALLOCATION_AUDIT_RETENTION = '0 20 3 * * *',
}

export const ALLOCATION_AUDIT_EXECUTE_DUE_VALIDATIONS_LOCK = {
  resourceName: 'AllocationAuditService:executeDueAudits',
  compatibleResourceNames: ['ReportValidationService:executeDueValidations'],
  // Keep single-run semantics even when OpenAI batch wait spans up to 24h.
  duration: 24 * 60 * 60 * 1000 + 5 * 60 * 1000,
} as const;
