export interface Schedule {
  id?: string;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const initialState: Schedule = {
  enabled: false,
};
