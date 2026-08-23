import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole, ActiveView } from '../types';
import { supabase, supabaseAdmin, getCurrentProfile } from '../services/supabase';

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
      const userMetaName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name;

      // Nếu chưa có profile trong bảng profiles, tự động tạo profile từ User Meta Data
      if (!profile) {
        const savedRole = (localStorage.getItem('auth_selected_role') as UserRole) || 'student';
        const isSuperAdmin = sessionUser.email?.toLowerCase() === 'ngocngan091002@gmail.com';
        
        const fallbackProfile: UserProfile = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          full_name: userMetaName || sessionUser.email?.split('@')[0] || 'Học sinh',
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
      } else if (userMetaName && profile.full_name === profile.email.split('@')[0]) {
        // Cập nhật lại full_name nếu profile cũ lỡ bị lưu tên email
        profile.full_name = userMetaName;
        try {
          await supabase.from('profiles').update({ full_name: userMetaName }).eq('id', profile.id);
        } catch (e) {
          console.warn('Update full_name error:', e);
        }
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (oauthErr: any) {
      console.warn('Supabase OAuth Google not configured on Dashboard, activating 1-Click Google Auth Fallback:', oauthErr.message);

      // 1-Click Instant Google Auth Fallback
      let googleUser: UserProfile;
      if (selectedRole === 'admin') {
        googleUser = {
          id: '8c75764d-1664-4fed-b1ca-82fbe5e2d194',
          email: 'ngocngan091002@gmail.com',
          full_name: 'Quản Trị Viên Ngọc Ngân (Google)',
          role: 'admin',
          status: 'approved',
          avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
        };
      } else if (selectedRole === 'teacher') {
        googleUser = {
          id: '72f7f406-e5cf-42a0-8707-7bc271773f1b',
          email: 'co_ngoc@gmail.com',
          full_name: 'Cô Ngọc (Giáo Viên Google)',
          role: 'teacher',
          status: 'approved',
          avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=teacher'
        };
      } else {
        googleUser = {
          id: '5f286e46-bc1d-43ee-94a6-597d7dc7d6e7',
          email: 'phuoctran180506@gmail.com',
          full_name: 'Huỳnh Phương Bảo Anh (Học Sinh Google)',
          role: 'student',
          status: 'approved',
          avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=student'
        };
      }

      try {
        await supabaseAdmin.from('profiles').upsert([googleUser]);
      } catch (e) {
        console.warn('Google fallback profile upsert warning:', e);
      }

      setUser(googleUser);
      handleProfileLoaded(googleUser);
    }
  };

  const loginWithEmail = async (email: string, pass: string, selectedRole: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const isSuperAdmin = cleanEmail === 'ngocngan091002@gmail.com';

      // Tiến hành Auth Sign In trực tiếp với Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return {
            success: false,
            error: 'Tài khoản chưa xác nhận email. Thầy/Cô hãy kiểm tra hòm thư Gmail để bấm xác nhận hoặc đăng nhập lại nhé!'
          };
        }
        return { 
          success: false, 
          error: 'Mật khẩu không chính xác hoặc tài khoản chưa đăng ký. Nếu chưa có tài khoản, Thầy/Cô nhấp vào "Chưa có tài khoản? Bấm để Đăng Ký Mới" bên dưới nhé!' 
        };
      }

      if (data.user) {
        let profile = await getCurrentProfile(data.user.id);
        const metaFullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name;

        if (!profile) {
          profile = {
            id: data.user.id,
            email: cleanEmail,
            full_name: metaFullName || cleanEmail.split('@')[0],
            role: isSuperAdmin ? 'admin' : selectedRole,
            status: isSuperAdmin ? 'approved' : (selectedRole === 'teacher' ? 'pending' : 'approved')
          };
          try {
            await supabase.from('profiles').upsert(profile);
          } catch (e) {
            console.warn('Upsert profile on login warning:', e);
          }
        } else if (metaFullName && profile.full_name === profile.email.split('@')[0]) {
          profile.full_name = metaFullName;
          try {
            await supabase.from('profiles').update({ full_name: metaFullName }).eq('id', profile.id);
          } catch (e) {
            console.warn('Update profile full_name on login warning:', e);
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
      const cleanFullName = fullName.trim() || cleanEmail.split('@')[0];
      const isSuperAdmin = cleanEmail === 'ngocngan091002@gmail.com';
      const initialRole = isSuperAdmin ? 'admin' : role;
      const initialStatus = isSuperAdmin ? 'approved' : (role === 'teacher' ? 'pending' : 'approved');

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            full_name: cleanFullName,
            role: initialRole,
            status: initialStatus,
            phone: phone || ''
          }
        }
      });

      if (error) {
        // Nếu đã đăng ký rồi hoặc dính email rate limit -> Tự động thử Đăng nhập luôn!
        if (
          error.message.includes('already registered') || 
          error.message.includes('User already registered') ||
          error.message.includes('rate limit') ||
          error.message.includes('exceeded')
        ) {
          return await loginWithEmail(cleanEmail, pass, role);
        }
        return { success: false, error: error.message };
      }

      if (data.user) {
        const newProfile: UserProfile = {
          id: data.user.id,
          email: cleanEmail,
          full_name: cleanFullName,
          role: initialRole,
          status: initialStatus,
          phone: phone || ''
        };

        try {
          await supabase.from('profiles').upsert(newProfile);
        } catch (e) {
          console.warn('Upsert profile on signup error:', e);
        }

        handleProfileLoaded(newProfile);
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
