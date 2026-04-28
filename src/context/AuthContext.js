import { createContext, useContext } from 'react';

// Provides a direct signOut callback from App.js so any screen can sign out
// without relying on the module-level listener Set in authService.
export const AuthContext = createContext(() => {});

export const useSignOut = () => useContext(AuthContext);
