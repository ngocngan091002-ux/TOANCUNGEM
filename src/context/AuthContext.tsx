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
    // Check initial Supabase Session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await getCurrentProfile(session.user.id);
          if (profile) {
            handleProfileLoaded(profile);
          }
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
        const profile = await getCurrentProfile(session.user.id);
        if (profile) {
          handleProfileLoaded(profile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleProfileLoaded = (profile: UserProfile) => {
    // Admin mặc định
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
    // Đặt role tạm thời trong localStorage để trigger gán role đúng khi return
    localStorage.setItem('auth_selected_role', selectedRole);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const loginWithEmail = async (email: string, pass: string, selectedRole: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Kiểm tra Email xem đã đăng ký trong DB hay chưa
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.trim().toLowerCase());

      const profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // Nếu gmail chưa đăng ký -> Chặn đăng nhập theo yêu cầu!
      if (!profile) {
        return { 
          success: false, 
          error: 'Tài khoản chưa được đăng ký trong hệ thống. Vui lòng đăng ký tài khoản mới hoặc liên hệ Quản trị viên!' 
        };
      }

      // 2. Kiểm tra trạng thái Giáo viên
      if (profile.role === 'teacher' && profile.status === 'pending') {
        return {
          success: false,
          error: 'Tài khoản Giáo viên của bạn đang chờ Quản trị viên duyệt. Vui lòng đợi thông báo!'
        };
      }

      if (profile.status === 'rejected') {
        return {
          success: false,
          error: 'Tài khoản của bạn đã bị từ chối truy cập.'
        };
      }

      // 3. Tiến hành Auth Sign In
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass
      });

      if (error) {
        return { success: false, error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!' };
      }

      if (data.user) {
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
      const isSuperAdmin = email.trim().toLowerCase() === 'ngocngan091002@gmail.com';
      const initialRole = isSuperAdmin ? 'admin' : role;
      const initialStatus = isSuperAdmin ? 'approved' : (role === 'teacher' ? 'pending' : 'approved');

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
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
        // Chèn vào bảng profiles thủ công nếu trigger chưa kích hoạt
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email.trim().toLowerCase(),
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
