import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { loggedOut } from './authSlice';

export interface SelectedEventValue {
  eventId: number;
  organizerId: number;
}

interface SelectedEventState {
  eventId: number | null;
  organizerId: number | null;
  restored: boolean;
}

const initialState: SelectedEventState = {
  eventId: null,
  organizerId: null,
  restored: false,
};

const selectedEventSlice = createSlice({
  name: 'selectedEvent',
  initialState,
  reducers: {
    selectedEventRestored(state, action: PayloadAction<SelectedEventValue | null>) {
      state.eventId = action.payload?.eventId ?? null;
      state.organizerId = action.payload?.organizerId ?? null;
      state.restored = true;
    },
    eventSelected(state, action: PayloadAction<SelectedEventValue>) {
      state.eventId = action.payload.eventId;
      state.organizerId = action.payload.organizerId;
    },
    selectedEventCleared(state) {
      state.eventId = null;
      state.organizerId = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loggedOut, (state) => {
      state.eventId = null;
      state.organizerId = null;
    });
  },
});

export const { selectedEventRestored, eventSelected, selectedEventCleared } = selectedEventSlice.actions;
export default selectedEventSlice.reducer;
