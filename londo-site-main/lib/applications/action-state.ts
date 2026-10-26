export type ApplicationActionState = {
  message: string | null;
  ok: boolean;
};

export const initialApplicationActionState: ApplicationActionState = {
  message: null,
  ok: false,
};
