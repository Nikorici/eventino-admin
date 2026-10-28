import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface UiState {
  toast: ToastMessage | null;
  country: string | null;
  seq: number;
}

const initialState: UiState = {
  toast: null,
  country: null,
  seq: 0,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showToast: {
      reducer(state, action: PayloadAction<ToastMessage>) {
        state.toast = action.payload;
        state.seq = action.payload.id;
      },
      prepare(payload: { type?: ToastType; message: string }) {
        return { payload: { id: Date.now(), type: payload.type ?? 'info', message: payload.message } };
      },
    },
    hideToast(state) {
      state.toast = null;
    },
    setCountry(state, action: PayloadAction<string | null>) {
      state.country = action.payload;
    },
  },
});

export const { showToast, hideToast, setCountry } = uiSlice.actions;
export default uiSlice.reducer;
