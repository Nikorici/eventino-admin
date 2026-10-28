import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { User } from '@/types/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.isAuthenticated = action.payload != null;
    },
    setAuthenticated(state, action: PayloadAction<boolean>) {
      state.isAuthenticated = action.payload;
    },
    setBootstrapping(state, action: PayloadAction<boolean>) {
      state.isBootstrapping = action.payload;
    },
    loggedOut(state) {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setUser, setAuthenticated, setBootstrapping, loggedOut } = authSlice.actions;
export default authSlice.reducer;
