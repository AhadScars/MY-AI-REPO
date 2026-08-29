import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DemoUser, KycStatus, RgLimits } from '../types';
import { defaultLimits, demoUsers } from '../data/account';

interface AuthState {
  user: DemoUser | null;
  limits: RgLimits;
  pendingEmail: string | null;
  login: (email: string, password: string) => { ok: boolean; error?: string; needs2fa?: boolean };
  complete2fa: (code: string) => { ok: boolean; error?: string };
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dob: string;
    country: string;
  }) => { ok: boolean; error?: string };
  logout: () => void;
  updateProfile: (patch: Partial<DemoUser>) => void;
  setLimits: (patch: Partial<RgLimits>) => void;
  setKyc: (kyc: KycStatus) => void;
}

const pending = new Map<string, DemoUser>();

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      limits: defaultLimits,
      pendingEmail: null,
      login: (email, password) => {
        const found = demoUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!found || found.password !== password) {
          return { ok: false, error: 'Those credentials don’t match a demo account.' };
        }
        if (found.twoFactor) {
          pending.set(found.email, found);
          set({ pendingEmail: found.email });
          return { ok: true, needs2fa: true };
        }
        set({ user: found, pendingEmail: null });
        return { ok: true };
      },
      complete2fa: (code) => {
        const email = get().pendingEmail;
        if (!email) return { ok: false, error: 'No login in progress.' };
        if (code.trim() !== '847291' && code.trim() !== '000000') {
          return { ok: false, error: 'Invalid authenticator code. Use 847291 for the demo.' };
        }
        const found = pending.get(email);
        if (!found) return { ok: false, error: 'Session expired. Sign in again.' };
        pending.delete(email);
        set({ user: found, pendingEmail: null });
        return { ok: true };
      },
      register: (input) => {
        if (!input.email.includes('@')) return { ok: false, error: 'Enter a valid email address.' };
        if (input.password.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
        const age = Math.floor((Date.now() - new Date(input.dob).getTime()) / (365.25 * 86400000));
        if (!input.dob || Number.isNaN(age) || age < 18) {
          return { ok: false, error: 'You must be 18 or over to create an account.' };
        }
        const user: DemoUser = {
          id: `u_${Math.random().toString(36).slice(2, 8)}`,
          email: input.email.trim(),
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: `${input.firstName} ${input.lastName}`.trim(),
          handle: input.email.split('@')[0],
          dob: input.dob,
          country: input.country,
          currency: 'INR',
          phone: '',
          role: 'user',
          kyc: 'unverified',
          twoFactor: false,
          emailVerified: false,
          createdAt: new Date().toISOString(),
        };
        demoUsers.push(user);
        set({ user });
        return { ok: true };
      },
      logout: () => set({ user: null, pendingEmail: null }),
      updateProfile: (patch) => {
        const user = get().user;
        if (!user) return;
        set({ user: { ...user, ...patch } });
      },
      setLimits: (patch) => set({ limits: { ...get().limits, ...patch } }),
      setKyc: (kyc) => {
        const user = get().user;
        if (!user) return;
        set({ user: { ...user, kyc } });
      },
    }),
    { name: 'nexora-auth' },
  ),
);
