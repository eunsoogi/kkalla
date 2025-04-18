export enum ScheduleExpression {
  EVERY_DAY_WITH_NEW_ITEMS = '0 35 6 * * *',
  EVERY_HOUR_WITH_EXIST_ITEMS = '0 35 0,2,4,8,10,12,14,16,18,20,22 * * *',
}
