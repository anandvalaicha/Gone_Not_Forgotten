// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateUser = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockUpsert = jest.fn();

jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args) => mockSignUp(...args),
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
      signOut: (...args) => mockSignOut(...args),
      updateUser: (...args) => mockUpdateUser(...args),
      resetPasswordForEmail: (...args) => mockResetPasswordForEmail(...args),
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    },
    from: jest.fn(() => ({ upsert: mockUpsert })),
  },
  isSupabaseConfigured: true,
  SUPABASE_URL: 'https://test.supabase.co',
}));

// AsyncStorage is auto-mocked via __mocks__/@react-native-async-storage/async-storage.js
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { authService } = require('../../services/authService');

// Suppress console noise from error-path tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Reset currentUser between tests by clearing the module-level state via signOut
beforeEach(async () => {
  jest.clearAllMocks();
  // Reset currentUser by simulating a clean signout (no-op side effects)
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.getAllKeys.mockResolvedValue([]);
  mockSignOut.mockResolvedValue({ error: null });
  await authService.signOutUser();
  jest.clearAllMocks(); // clear again after the setup signout
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeSupabaseUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    first_name: 'John',
    last_name: 'Doe',
    display_name: 'John Doe',
    phone: '555-1234',
    age: '30',
    gender: 'male',
    bio: 'A bio',
    birth_year: '1990',
    death_year: null,
    photo_url: 'https://example.com/photo.jpg',
  },
  ...overrides,
});

// ── signUp ────────────────────────────────────────────────────────────────────
describe('authService.signUp', () => {
  it('returns success and normalized user on successful signup', async () => {
    const supabaseUser = makeSupabaseUser();
    mockSignUp.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await authService.signUp('test@example.com', 'password123', {
      firstName: 'John',
      lastName: 'Doe',
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.id).toBe('user-123');
    expect(result.user.displayName).toBe('John Doe');
    expect(result.user.firstName).toBe('John');
    expect(result.user.lastName).toBe('Doe');
  });

  it('returns error when signup fails', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: { message: 'Email already in use' } });

    const result = await authService.signUp('existing@example.com', 'password123');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Email already in use');
  });

  it('builds display_name from first and last name', async () => {
    const supabaseUser = makeSupabaseUser();
    mockSignUp.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await authService.signUp('test@example.com', 'pass', {
      firstName: 'Jane',
      lastName: 'Smith',
    });

    const callArgs = mockSignUp.mock.calls[0][0];
    expect(callArgs.options.data.display_name).toBe('Jane Smith');
    expect(callArgs.options.data.first_name).toBe('Jane');
    expect(callArgs.options.data.last_name).toBe('Smith');
  });

  it('includes optional profile fields in metadata', async () => {
    const supabaseUser = makeSupabaseUser();
    mockSignUp.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await authService.signUp('test@example.com', 'pass', {
      phone: '555-9999',
      age: '25',
      gender: 'female',
    });

    const callArgs = mockSignUp.mock.calls[0][0];
    expect(callArgs.options.data.phone).toBe('555-9999');
    expect(callArgs.options.data.age).toBe('25');
    expect(callArgs.options.data.gender).toBe('female');
  });
});

// ── signIn ────────────────────────────────────────────────────────────────────
describe('authService.signIn', () => {
  it('returns success and normalized user on successful login', async () => {
    const supabaseUser = makeSupabaseUser();
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await authService.signIn('test@example.com', 'password123');

    expect(result.success).toBe(true);
    expect(result.user.id).toBe('user-123');
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.photoURL).toBe('https://example.com/photo.jpg');
  });

  it('returns error on wrong credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });

    const result = await authService.signIn('test@example.com', 'wrongpass');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid login credentials');
  });

  it('sets currentUser after successful login', async () => {
    const supabaseUser = makeSupabaseUser();
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await authService.signIn('test@example.com', 'password123');

    expect(authService.getCurrentUser()).not.toBeNull();
    expect(authService.getCurrentUser().id).toBe('user-123');
  });
});

// ── signInWithGoogle ──────────────────────────────────────────────────────────
describe('authService.signInWithGoogle', () => {
  it('always returns failure with explanation', async () => {
    const result = await authService.signInWithGoogle();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Google/i);
  });
});

// ── signOutUser ───────────────────────────────────────────────────────────────
describe('authService.signOutUser', () => {
  it('clears currentUser and returns success', async () => {
    const supabaseUser = makeSupabaseUser();
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });
    await authService.signIn('test@example.com', 'password123');
    expect(authService.getCurrentUser()).not.toBeNull();

    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.getAllKeys.mockResolvedValue([]);
    mockSignOut.mockResolvedValue({ error: null });

    const result = await authService.signOutUser();

    expect(result.success).toBe(true);
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('removes the auth token key from AsyncStorage', async () => {
    AsyncStorage.getItem.mockResolvedValue('token-value');
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    AsyncStorage.getAllKeys.mockResolvedValue(['sb-rsxeuflqdwoeohyvrlgp-auth-token']);
    AsyncStorage.multiRemove.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });

    await authService.signOutUser();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('sb-rsxeuflqdwoeohyvrlgp-auth-token');
  });

  it('sweeps extra supabase keys from AsyncStorage', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    AsyncStorage.getAllKeys.mockResolvedValue(['sb-extra-key', 'unrelated-key', 'supabase_session']);
    AsyncStorage.multiRemove.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });

    await authService.signOutUser();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['sb-extra-key', 'supabase_session']);
  });

  it('calls supabase.auth.signOut with local scope', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.getAllKeys.mockResolvedValue([]);
    mockSignOut.mockResolvedValue({ error: null });

    await authService.signOutUser();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('still succeeds if supabase signOut throws', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.getAllKeys.mockResolvedValue([]);
    mockSignOut.mockRejectedValue(new Error('network error'));

    const result = await authService.signOutUser();

    expect(result.success).toBe(true);
    expect(authService.getCurrentUser()).toBeNull();
  });
});

// ── updateUserProfile ─────────────────────────────────────────────────────────
describe('authService.updateUserProfile', () => {
  it('maps camelCase fields to snake_case metadata', async () => {
    const updatedUser = makeSupabaseUser({
      user_metadata: { first_name: 'Jane', last_name: 'Smith', display_name: 'Jane Smith' },
    });
    mockUpdateUser.mockResolvedValue({ data: { user: updatedUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await authService.updateUserProfile({
      firstName: 'Jane',
      lastName: 'Smith',
    });

    const callArgs = mockUpdateUser.mock.calls[0][0];
    expect(callArgs.data.first_name).toBe('Jane');
    expect(callArgs.data.last_name).toBe('Smith');
    expect(callArgs.data.display_name).toBe('Jane Smith');
    expect(result.success).toBe(true);
  });

  it('maps photoURL to photo_url', async () => {
    const updatedUser = makeSupabaseUser();
    mockUpdateUser.mockResolvedValue({ data: { user: updatedUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await authService.updateUserProfile({ photoURL: 'https://example.com/new.jpg' });

    const callArgs = mockUpdateUser.mock.calls[0][0];
    expect(callArgs.data.photo_url).toBe('https://example.com/new.jpg');
  });

  it('includes email in payload when provided', async () => {
    const updatedUser = makeSupabaseUser({ email: 'new@example.com' });
    mockUpdateUser.mockResolvedValue({ data: { user: updatedUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await authService.updateUserProfile({ email: 'new@example.com' });

    const callArgs = mockUpdateUser.mock.calls[0][0];
    expect(callArgs.email).toBe('new@example.com');
  });

  it('returns error when update fails', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: { message: 'Update failed' } });

    const result = await authService.updateUserProfile({ bio: 'new bio' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Update failed');
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────
describe('authService.resetPassword', () => {
  it('calls resetPasswordForEmail with trimmed email', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    const result = await authService.resetPassword('  test@example.com  ');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {});
    expect(result.success).toBe(true);
  });

  it('passes redirectTo option when provided', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    await authService.resetPassword('test@example.com', 'myapp://reset');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      redirectTo: 'myapp://reset',
    });
  });

  it('returns error when reset fails', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } });

    const result = await authService.resetPassword('nobody@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });
});

// ── changePassword ────────────────────────────────────────────────────────────
describe('authService.changePassword', () => {
  it('calls updateUser with new password', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    const result = await authService.changePassword('newSecurePass!');

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newSecurePass!' });
    expect(result.success).toBe(true);
  });

  it('returns error when change fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Password too short' } });

    const result = await authService.changePassword('abc');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Password too short');
  });
});

// ── onAuthStateChange ─────────────────────────────────────────────────────────
describe('authService.onAuthStateChange', () => {
  it('fires callback immediately with current session user', async () => {
    const supabaseUser = makeSupabaseUser();
    mockGetSession.mockResolvedValue({ data: { session: { user: supabaseUser } } });
    const mockUnsubscribe = jest.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const callback = jest.fn();
    authService.onAuthStateChange(callback);

    await new Promise(setImmediate);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-123', email: 'test@example.com' })
    );
  });

  it('fires callback with null when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const mockUnsubscribe = jest.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const callback = jest.fn();
    authService.onAuthStateChange(callback);

    await new Promise(setImmediate);

    expect(callback).toHaveBeenCalledWith(null);
  });

  it('returns an unsubscribe function', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const mockUnsubscribe = jest.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const unsubscribe = authService.onAuthStateChange(jest.fn());
    unsubscribe();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ── getCurrentUser ────────────────────────────────────────────────────────────
describe('authService.getCurrentUser', () => {
  it('returns null before any login', () => {
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('returns user after successful login', async () => {
    const supabaseUser = makeSupabaseUser();
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await authService.signIn('test@example.com', 'password123');

    expect(authService.getCurrentUser()).toMatchObject({ id: 'user-123' });
  });
});

// ── normalizeUser (via signIn) ────────────────────────────────────────────────
describe('normalizeUser (via signIn)', () => {
  it('falls back displayName to email prefix when no name metadata', async () => {
    const supabaseUser = {
      id: 'u1',
      email: 'john.doe@example.com',
      user_metadata: {},
    };
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await authService.signIn('john.doe@example.com', 'pass');

    expect(result.user.displayName).toBe('john doe');
  });

  it('prefers display_name over first_name + last_name', async () => {
    const supabaseUser = makeSupabaseUser({
      user_metadata: {
        display_name: 'Custom Name',
        first_name: 'John',
        last_name: 'Doe',
      },
    });
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await authService.signIn('test@example.com', 'pass');

    expect(result.user.displayName).toBe('Custom Name');
  });

  it('uses photo_url for photoURL', async () => {
    const supabaseUser = makeSupabaseUser({
      user_metadata: { photo_url: 'https://cdn.example.com/avatar.jpg' },
    });
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await authService.signIn('test@example.com', 'pass');

    expect(result.user.photoURL).toBe('https://cdn.example.com/avatar.jpg');
  });

  it('falls back to avatar_url when photo_url is absent', async () => {
    const supabaseUser = makeSupabaseUser({
      user_metadata: { avatar_url: 'https://cdn.example.com/avatar2.jpg' },
    });
    mockSignInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await authService.signIn('test@example.com', 'pass');

    expect(result.user.photoURL).toBe('https://cdn.example.com/avatar2.jpg');
  });
});
