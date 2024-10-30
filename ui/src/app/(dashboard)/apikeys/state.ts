export type State = {
  success: boolean;
  message?: string | null;
};

export const initialState: State = {
  success: true,
  message: null,
};
