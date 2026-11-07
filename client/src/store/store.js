import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import listsReducer from './listsSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    lists: listsReducer,
  },
});

export default store;
