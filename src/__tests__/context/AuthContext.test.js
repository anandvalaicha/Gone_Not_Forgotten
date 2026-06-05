import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthContext, useSignOut, useOnPasswordReset } from '../../context/AuthContext';

// ── useSignOut ────────────────────────────────────────────────────────────────
describe('useSignOut', () => {
  it('returns the signOut function from context', () => {
    const signOut = jest.fn();
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ signOut, onPasswordReset: jest.fn() }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useSignOut(), { wrapper });

    expect(result.current).toBe(signOut);
  });

  it('calls the signOut function when invoked', () => {
    const signOut = jest.fn();
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ signOut, onPasswordReset: jest.fn() }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useSignOut(), { wrapper });

    act(() => result.current());

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('returns a no-op function when used outside a provider (default context)', () => {
    const { result } = renderHook(() => useSignOut());
    expect(() => result.current()).not.toThrow();
  });
});

// ── useOnPasswordReset ────────────────────────────────────────────────────────
describe('useOnPasswordReset', () => {
  it('returns the onPasswordReset function from context', () => {
    const onPasswordReset = jest.fn();
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ signOut: jest.fn(), onPasswordReset }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useOnPasswordReset(), { wrapper });

    expect(result.current).toBe(onPasswordReset);
  });

  it('calls the onPasswordReset function when invoked', () => {
    const onPasswordReset = jest.fn();
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ signOut: jest.fn(), onPasswordReset }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useOnPasswordReset(), { wrapper });

    act(() => result.current());

    expect(onPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('returns a no-op function when used outside a provider (default context)', () => {
    const { result } = renderHook(() => useOnPasswordReset());
    expect(() => result.current()).not.toThrow();
  });
});

// ── AuthContext default values ────────────────────────────────────────────────
describe('AuthContext defaults', () => {
  it('default signOut is a function', () => {
    const { result } = renderHook(() => React.useContext(AuthContext));
    expect(typeof result.current.signOut).toBe('function');
  });

  it('default onPasswordReset is a function', () => {
    const { result } = renderHook(() => React.useContext(AuthContext));
    expect(typeof result.current.onPasswordReset).toBe('function');
  });
});
