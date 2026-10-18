import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
type State = {
  access: string | null;
  status: "loading" | "authenticated" | "anonymous" | "offline";
};
const initialState: State = { access: null, status: "loading" };
const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    tokenReceived(state, action: PayloadAction<string>) {
      state.access = action.payload;
      state.status = "authenticated";
    },
    signedOut(state) {
      state.access = null;
      state.status = "anonymous";
    },
    networkUnavailable(state) {
      state.status = "offline";
    },
  },
});
export const { tokenReceived, signedOut, networkUnavailable } = slice.actions;
export default slice.reducer;
