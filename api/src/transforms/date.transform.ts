import { Transform } from 'class-transformer';

export function ToDate() {
  return Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  });
}
