'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, full_name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        
        // 프로필 테이블이 없거나 접근 권한이 없을 때 임시 사용자 생성
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          // 임시: 특정 이메일을 관리자로 설정 (개발용)
          const isAdmin = sessionData.session.user.email === 'admin@example.com'; // 여기에 본인 이메일 입력
          
          const tempUser: User = {
            id: sessionData.session.user.id,
            email: sessionData.session.user.email!,
            full_name: sessionData.session.user.user_metadata?.full_name || null,
            avatar_url: null,
            role: isAdmin ? 'admin' : 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setUser(tempUser);
          
          // 백그라운드에서 프로필 생성 시도
          try {
            await supabase.from('profiles').insert({
              id: tempUser.id,
              email: tempUser.email,
              full_name: tempUser.full_name,
              role: 'user',
            });
          } catch (createError) {
            console.warn('Could not create profile in database:', createError);
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      // 임시 사용자라도 생성하여 로그인 상태 유지
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        // 임시: 특정 이메일을 관리자로 설정 (개발용)
        const isAdmin = sessionData.session.user.email === 'admin@example.com'; // 여기에 본인 이메일 입력
        
        const tempUser: User = {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email!,
          full_name: sessionData.session.user.user_metadata?.full_name || null,
          avatar_url: null,
          role: isAdmin ? 'admin' : 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUser(tempUser);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, full_name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || '',
        },
      },
    });

    if (error) throw error;

    // 회원가입 성공시 자동으로 프로필이 생성됨 (트리거에 의해)
    // 추가적인 프로필 생성 로직은 제거
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) throw error;

    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}