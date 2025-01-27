export enum ScheduleExpression {
  BUY_EVERY_4_HOURS = '0 0 */4 * * *',
  SELL_EVERY_15_MINUTES = '0 */15 1-3,5-7,9-11,13-15,17-19,21-23 * * *',
}
