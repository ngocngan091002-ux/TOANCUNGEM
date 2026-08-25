import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole, ActiveView } from '../types';
import { supabase, supabaseAdmin, getCurrentProfile, getProfileByIdOrEmail } from '../services/supabase';

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

      const email = sessionUser.email ? sessionUser.email.toLowerCase() : '';
      let profile = await getProfileByIdOrEmail(sessionUser.id, email);
      const userMetaName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name;

      // Nếu chưa có profile trong bảng profiles, tự động tạo profile từ User Meta Data bằng supabaseAdmin (bypassing RLS)
      if (!profile) {
        const savedRole = (localStorage.getItem('auth_selected_role') as UserRole) || 'student';
        const isSuperAdmin = email === 'ngocngan091002@gmail.com';
        
        const fallbackProfile: UserProfile = {
          id: sessionUser.id,
          email: email,
          full_name: userMetaName || email.split('@')[0] || 'Người dùng Google',
          role: isSuperAdmin ? 'admin' : savedRole,
          status: 'approved',
          avatar_url: sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || ''
        };

        try {
          await supabaseAdmin.from('profiles').upsert([fallbackProfile]);
        } catch (e) {
          console.warn('Upsert fallback profile warning:', e);
        }

        profile = fallbackProfile;
      } else {
        // Đồng bộ lại ID profile cho trùng với sessionUser.id
        if (profile.id !== sessionUser.id) {
          try {
            await supabaseAdmin.from('profiles').update({ id: sessionUser.id }).eq('email', email);
            profile.id = sessionUser.id;
          } catch (e) {
            console.warn('Sync profile ID error:', e);
          }
        }
      }

      // 3. Luôn kiểm tra CSDL để nạp đúng Họ và Tên chuẩn 100% của học sinh (VD: Trần Dương Thanh Ngọc, Nguyễn Lâm Lan Anh)
      if (email && profile) {
        const { data: dbReal } = await supabaseAdmin
          .from('profiles')
          .select('full_name, student_code')
          .or(`email.eq.${email},student_code.ilike.${email}`)
          .maybeSingle();

        if (dbReal && dbReal.full_name) {
          profile.full_name = dbReal.full_name;
          if (dbReal.student_code) profile.student_code = dbReal.student_code;
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account' // Ưu tiên hiển thị danh sách tài khoản Google đã đăng nhập trên thiết bị
        }
      }
    });

    if (error) {
      console.error('Google OAuth signInWithOAuth error:', error);
      throw error;
    }
  };

  const loginWithEmail = async (emailInput: string, pass: string, selectedRole: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      const rawInput = emailInput.trim();
      let cleanEmail = rawInput.toLowerCase();
      const isSuperAdmin = cleanEmail === 'ngocngan091002@gmail.com';

      // 0. Nếu người dùng nhập Mã Học Sinh (VD: HS2026_02 hoặc hs2026_02), tự động tra cứu Email & Họ Tên thực tế từ DB profiles
      let matchedStudentProfile: UserProfile | null = null;
      const { data: byCode } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('student_code', rawInput)
        .maybeSingle();

      if (byCode) {
        matchedStudentProfile = byCode as UserProfile;
        if (byCode.email) cleanEmail = byCode.email.toLowerCase();
      }

      // 1. Thử Đăng nhập trực tiếp với Supabase Auth
      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      // 2. Nếu Auth báo sai tài khoản/mật khẩu, kiểm tra trong DB profiles xem có phải học sinh do Admin thêm không
      if (error) {
        let dbProfile = matchedStudentProfile;
        if (!dbProfile) {
          const { data: pData } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();
          dbProfile = pData as UserProfile;
        }

        if (dbProfile) {
          const defaultPassword = dbProfile.parent_pin || pass || '123456';
          try {
            // Tự động tạo/đồng bộ Auth User cho học sinh này với mật khẩu mặc định và Họ Tên thực tế
            const { data: newAuth } = await supabaseAdmin.auth.admin.createUser({
              email: cleanEmail,
              password: defaultPassword,
              email_confirm: true,
              user_metadata: {
                full_name: dbProfile.full_name,
                role: dbProfile.role || selectedRole,
                status: 'approved'
              }
            });

            if (newAuth?.user) {
              await supabaseAdmin.from('profiles').update({ id: newAuth.user.id, full_name: dbProfile.full_name }).eq('email', cleanEmail);
            } else {
              // Cập nhật lại mật khẩu & Họ Tên thực tế nếu tài khoản Auth đã có sẵn
              const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
              const existingAuth = usersData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
              if (existingAuth) {
                await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, { 
                  password: defaultPassword,
                  user_metadata: { full_name: dbProfile.full_name }
                });
                await supabaseAdmin.from('profiles').update({ id: existingAuth.id, full_name: dbProfile.full_name }).eq('email', cleanEmail);
              }
            }

            // Đăng nhập lại ngay lập tức!
            const retry = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: defaultPassword
            });
            data = retry.data;
            error = retry.error;
          } catch (autoErr) {
            console.warn('Auto auth provisioning error:', autoErr);
          }
        }
      }

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return {
            success: false,
            error: 'Tài khoản chưa xác nhận email. Thầy/Cô hãy kiểm tra hòm thư Gmail để bấm xác nhận hoặc đăng nhập lại nhé!'
          };
        }
        return { 
          success: false, 
          error: 'Mật khẩu không chính xác hoặc tài khoản chưa đăng ký. Vui lòng kiểm tra lại Email & Mật khẩu!' 
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
