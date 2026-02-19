export enum ScheduleExpression {
  HOURLY_REPORT_VALIDATION = '0 15 * * * *',
  DAILY_REPORT_VALIDATION_RETENTION = '0 20 3 * * *',
}

export const REPORT_VALIDATION_EXECUTE_DUE_VALIDATIONS_LOCK = {
  resourceName: 'ReportValidationService:executeDueValidations',
  duration: 3_600_000,
} as const;
