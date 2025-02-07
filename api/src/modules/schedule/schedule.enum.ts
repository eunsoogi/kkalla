export enum ScheduleExpression {
  EVERY_4_HOURS = '0 0 */4 * * *',
  EVERY_30_MINUTES_WITHOUT_EVERY_4_HOURS = '0 */30 1-3,5-7,9-11,13-15,17-19,21-23 * * *',
}
