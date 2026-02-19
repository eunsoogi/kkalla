export enum ScheduleExpression {
  HOURLY_REPORT_VALIDATION = '0 15 * * * *',
  DAILY_REPORT_VALIDATION_RETENTION = '0 20 3 * * *',
}

export const REPORT_VALIDATION_EXECUTE_DUE_VALIDATIONS_LOCK = {
  resourceName: 'ReportValidationService:executeDueValidations',
  // Keep single-run semantics even when OpenAI batch wait spans up to 24h.
  duration: 24 * 60 * 60 * 1000 + 5 * 60 * 1000,
} as const;
