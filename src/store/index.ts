import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { baseApi } from './api/baseApi';
import authReducer from './slices/authSlice';
import selectedEventReducer from './slices/selectedEventSlice';
import themeReducer from './slices/themeSlice';
import uiReducer from './slices/uiSlice';

import './api/authApi';
import './api/eventsApi';
import './api/organizerApi';
import './api/usersApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    selectedEvent: selectedEventReducer,
    ui: uiReducer,
    theme: themeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
