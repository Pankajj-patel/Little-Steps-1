import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { translate, type TranslationKey } from '../shared/i18n';
import type { AgeGroup, LearningDomain, LocaleCode, UserProfile, UserRole } from '../shared/types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  locale: LocaleCode;
  ageGroups: AgeGroup[];
  learningDomains: LearningDomain[];
  verificationPreviewPath: string | null;
  setVerificationPreviewPath: (path: string | null) => void;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  t: (key: TranslationKey) => string;
  login: (email: string, password: string, portalRole?: UserRole) => Promise<UserProfile>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    preferredLocale?: LocaleCode;
  }) => Promise<{ user: UserProfile; verificationPreviewPath?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [learningDomains, setLearningDomains] = useState<LearningDomain[]>([]);
  const [verificationPreviewPath, setVerificationPreviewPath] = useState<string | null>(null);

  const locale: LocaleCode = user?.preferredLocale ?? 'en';

  const t = useCallback((key: TranslationKey) => translate(locale, key), [locale]);

  const refreshUser = useCallback(async () => {
    try {
      const { user: fetched } = await api.me();
      setUser(fetched);
      if (fetched.emailVerifiedAt) {
        setVerificationPreviewPath(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const [metaResult, meResult] = await Promise.allSettled([
          api.getCurriculumMeta(),
          api.me(),
        ]);
        if (!active) return;
        if (metaResult.status === 'fulfilled') {
          setAgeGroups(metaResult.value.ageGroups);
          setLearningDomains(metaResult.value.learningDomains);
        }
        if (meResult.status === 'fulfilled') {
          setUser(meResult.value.user);
        } else {
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, portalRole?: UserRole) => {
    const { user: loggedIn } = await api.login(email, password, portalRole);
    setUser(loggedIn);
    if (loggedIn.emailVerifiedAt) {
      setVerificationPreviewPath(null);
    }
    return loggedIn;
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      fullName: string;
      phoneNumber?: string;
      preferredLocale?: LocaleCode;
    }) => {
      const result = await api.register(payload);
      setUser(result.user);
      setVerificationPreviewPath(result.verificationPreviewPath ?? null);
      return result;
    },
    []
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setVerificationPreviewPath(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        locale,
        ageGroups,
        learningDomains,
        verificationPreviewPath,
        setVerificationPreviewPath,
        setUser,
        t,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

