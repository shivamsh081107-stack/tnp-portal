import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    profile: null,
    features: {},
    status: 'loading',
  },
  reducers: {
    sessionReady(state, action) {
      state.user = action.payload.user || null;
      state.profile = action.payload.profile || null;
      state.features = action.payload.features || {};
      state.status = 'ready';
    },
    sessionCleared(state) {
      state.user = null;
      state.profile = null;
      state.status = 'ready';
    },
    profileUpdated(state, action) {
      if (action.payload.profile) state.profile = action.payload.profile;
      if (action.payload.user) state.user = action.payload.user;
    },
    statusReady(state) {
      if (state.status === 'loading') state.status = 'ready';
    },
  },
});

export const { sessionReady, sessionCleared, profileUpdated, statusReady } = authSlice.actions;
export default authSlice.reducer;
