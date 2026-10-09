import { createAction, type Reducer } from '@reduxjs/toolkit';

export const resetAppState = createAction('app/resetState');

/** Reset inside persistReducer so its writer and hydration metadata survive. */
export function resettableReducer<State>(
  reducer: Reducer<State>,
): Reducer<State> {
  return (state, action) =>
    reducer(action.type === resetAppState.type ? undefined : state, action);
}
