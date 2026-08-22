import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole, ActiveView } from '../types';
import { supabase, getCurrentProfile } from '../services/supabase';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  loginWithGoogle: (role: UserRole) => Promise<void>;
  loginWithEmail: (email: string, pass: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, pass: string, fullName: string, role: UserRole, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<ActiveView>('student');

  useEffect(() => {
    const processSession = async (sessionUser: any) => {
      if (!sessionUser) {
        setUser(null);
        return;
      }

      let profile = await getCurrentProfile(sessionUser.id);

      // Nếu chưa có profile trong bảng profiles, tự động tạo profile từ User Meta Data
      if (!profile) {
        const savedRole = (localStorage.getItem('auth_selected_role') as UserRole) || 'student';
        const isSuperAdmin = sessionUser.email?.toLowerCase() === 'ngocngan091002@gmail.com';
        
        const fallbackProfile: UserProfile = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          full_name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Người dùng',
          role: isSuperAdmin ? 'admin' : savedRole,
          status: isSuperAdmin ? 'approved' : (savedRole === 'teacher' ? 'pending' : 'approved'),
          avatar_url: sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || ''
        };

        try {
          await supabase.from('profiles').upsert(fallbackProfile);
        } catch (e) {
          console.warn('Upsert fallback profile warning:', e);
        }

        profile = fallbackProfile;
      }

      handleProfileLoaded(profile);
    };

    // Check initial Supabase Session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await processSession(session.user);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await processSession(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleProfileLoaded = (profile: UserProfile) => {
    // Admin mặc định tối cao
    if (profile.email.toLowerCase() === 'ngocngan091002@gmail.com') {
      profile.role = 'admin';
      profile.status = 'approved';
    }

    setUser(profile);

    // Đặt mặc định activeView phù hợp với Role
    if (profile.role === 'admin') {
      setActiveView('admin');
    } else if (profile.role === 'teacher') {
      setActiveView('teacher');
    } else {
      setActiveView('student');
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const p = await getCurrentProfile(user.id);
      if (p) handleProfileLoaded(p);
    }
  };

  const loginWithGoogle = async (selectedRole: UserRole) => {
    localStorage.setItem('auth_selected_role', selectedRole);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      if (error.message.includes('provider is not enabled') || (error as any).code === 'validation_failed') {
        throw new Error('Tính năng Đăng nhập Google chưa được bật trong Supabase Auth Dashboard. Thầy/Cô vui lòng bật tính năng Google Provider trong Supabase hoặc Đăng ký bằng Email bên dưới ạ!');
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string, selectedRole: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const isSuperAdmin = cleanEmail === 'ngocngan091002@gmail.com';

      // 1. Tiến hành Auth Sign In trực tiếp với Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      if (error) {
        return { 
          success: false, 
          error: 'Email hoặc mật khẩu không chính xác. Nếu chưa từng đăng ký thành công, Thầy/Cô hãy nhấp "Chưa có tài khoản? Bấm để Đăng Ký Mới" bên dưới nhé!' 
        };
      }

      if (data.user) {
        let profile = await getCurrentProfile(data.user.id);

        if (!profile) {
          profile = {
            id: data.user.id,
            email: cleanEmail,
            full_name: cleanEmail.split('@')[0],
            role: isSuperAdmin ? 'admin' : selectedRole,
            status: isSuperAdmin ? 'approved' : (selectedRole === 'teacher' ? 'pending' : 'approved')
          };
          try {
            await supabase.from('profiles').upsert(profile);
          } catch (e) {
            console.warn('Upsert profile on login warning:', e);
          }
        }

        // Kiểm tra trạng thái Giáo viên
        if (profile.role === 'teacher' && profile.status === 'pending' && !isSuperAdmin) {
          return {
            success: false,
            error: 'Tài khoản Giáo viên của bạn đang chờ Quản trị viên duyệt. Vui lòng đợi thông báo!'
          };
        }

        handleProfileLoaded(profile);
        return { success: true };
      }

      return { success: false, error: 'Đăng nhập không thành công.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi kết nối cơ sở dữ liệu.' };
    }
  };

  const signUpWithEmail = async (email: string, pass: string, fullName: string, role: UserRole, phone?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const isSuperAdmin = cleanEmail === 'ngocngan091002@gmail.com';
      const initialRole = isSuperAdmin ? 'admin' : role;
      const initialStatus = isSuperAdmin ? 'approved' : (role === 'teacher' ? 'pending' : 'approved');

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            full_name: fullName,
            role: initialRole,
            status: initialStatus,
            phone: phone || ''
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: cleanEmail,
          full_name: fullName,
          role: initialRole,
          status: initialStatus,
          phone: phone || ''
        });

        if (role === 'teacher' && !isSuperAdmin) {
          return {
            success: true,
            error: 'Đăng ký thành công! Tài khoản Giáo viên cần được Quản trị viên phê duyệt trước khi đăng nhập.'
          };
        }
        return { success: true };
      }
      return { success: false, error: 'Đăng ký thất bại.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      activeView,
      setActiveView,
      loginWithGoogle,
      loginWithEmail,
      signUpWithEmail,
      logout,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
