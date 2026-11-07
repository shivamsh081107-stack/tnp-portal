import { createSlice } from '@reduxjs/toolkit';

const listsSlice = createSlice({
  name: 'lists',
  initialState: {
    key: '',
    items: [],
    pagination: null,
    page: 1,
    filters: {},
    status: 'idle',
    error: '',
  },
  reducers: {
    listRequested(state, action) {
      state.key = action.payload.key;
      state.page = action.payload.page;
      state.filters = action.payload.filters || {};
      state.status = 'loading';
      state.error = '';
      state.items = [];
    },
    listReceived(state, action) {
      if (action.payload.key !== state.key) return;
      state.items = action.payload.items || [];
      state.pagination = action.payload.pagination || null;
      state.status = 'ready';
    },
    listFailed(state, action) {
      if (action.payload.key !== state.key) return;
      state.status = 'error';
      state.error = action.payload.error || 'Request failed';
      state.items = [];
    },
  },
});

export const { listRequested, listReceived, listFailed } = listsSlice.actions;
export default listsSlice.reducer;
