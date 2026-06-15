// Authentication context provider

import { createContext, useContext } from 'react';

const defaultCtx = { signOut: () => {}, onPasswordReset: () => {} };

export const AuthContext = createContext(defaultCtx);

export const useSignOut = () => useContext(AuthContext).signOut;
export const useOnPasswordReset = () => useContext(AuthContext).onPasswordReset;

