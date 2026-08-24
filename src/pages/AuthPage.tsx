import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { supabaseAdmin } from '../services/supabase';
import { 
  School, GraduationCap, ShieldCheck, Mail, Lock, User, Phone, 
  LogIn, UserPlus, AlertCircle, CheckCircle2, Sparkles, Key, Eye, Search, X 
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { user, loginWithEmail, signUpWithEmail, loginWithGoogle } = useAuth();
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState<string>(''); // AUTH-07: VIP License Key

  // AUTH-04: PARENT PIN LOOKUP MODAL
  const [showParentModal, setShowParentModal] = useState<boolean>(false);
  const [parentStudentCode, setParentStudentCode] = useState<string>('');
  const [parentPin, setParentPin] = useState<string>('');
  const [parentSearchResult, setParentSearchResult] = useState<any>(null);
  const [parentLoading, setParentLoading] = useState<boolean>(false);
  const [parentError, setParentError] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setErrorMsg('Vui lòng nhập Họ và Tên!');
          setLoading(false);
          return;
        }

        // AUTH-07: KÍCH HOẠT LICENSE MÃ VIP GIÁO VIÊN
        let roleToRegister = selectedRole;
        const cleanKey = licenseKey.trim().toUpperCase();
        if (cleanKey === 'TEACHER2026' || cleanKey === 'VIP2026' || cleanKey === 'GIAOVIEN') {
          roleToRegister = 'teacher';
        }

        const res = await signUpWithEmail(email, password, fullName, roleToRegister, phone);
        if (!res.success) {
          setErrorMsg(res.error || 'Đăng ký không thành công.');
        } else {
          setSuccessMsg('🎉 Đăng ký thành công! Đã kích hoạt tài khoản. Bạn có thể đăng nhập ngay bây giờ.');
          setIsSignUp(false);
        }
      } else {
        const res = await loginWithEmail(email, password, selectedRole);
        if (!res.success) {
          setErrorMsg(res.error || 'Đăng nhập không thành công.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra trong quá trình xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    try {
      setLoading(true);
      await loginWithGoogle(selectedRole);
    } catch (err: any) {
      console.error('Google Login error:', err);
      setErrorMsg('Đăng nhập chưa thành công. Vui lòng thử lại!');
      setLoading(false);
    }
  };

  const handleQuickFillAdmin = () => {
    setSelectedRole('admin');
    setIsSignUp(false);
    setEmail('ngocngan091002@gmail.com');
    setPassword('12345678');
    setFullName('Quản Trị Viên Ngọc Ngân');
    setErrorMsg('');
    setSuccessMsg('🎉 Đã sẵn sàng tài khoản Admin! Thầy/Cô bấm nút cam "Vào Hệ Thống Học Tập" bên dưới để vào ngay nhé.');
  };

  // AUTH-04: PARENT PIN LOOKUP FUNCTION
  const handleParentLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentError('');
    setParentSearchResult(null);
    setParentLoading(true);

    try {
      const code = parentStudentCode.trim().toUpperCase();
      const pin = parentPin.trim();

      // Tra cứu profile bằng Mã Học Sinh
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('student_code', code);

      if (pErr || !profiles || profiles.length === 0) {
        setParentError('Không tìm thấy Học sinh có mã này! Vui lòng kiểm tra lại Mã Học Sinh.');
        setParentLoading(false);
        return;
      }

      const st = profiles[0];
      // Kiểm tra PIN (Mặc định 123456 hoặc st.parent_pin)
      const validPin = st.parent_pin || '123456';
      if (pin !== validPin && pin !== '123456') {
        setParentError('Mã PIN Phụ Huynh không chính xác! (Mã mặc định: 123456)');
        setParentLoading(false);
        return;
      }

      // Lấy tiến độ học tập & điểm số của Học sinh
      const { data: progress } = await supabaseAdmin
        .from('student_progress')
        .select('*, assignment:assignments(*)')
        .eq('student_id', st.id);

      const { data: tasks } = await supabaseAdmin
        .from('task_completions')
        .select('*')
        .eq('student_id', st.id);

      setParentSearchResult({
        student: st,
        completed_tasks: tasks?.length || 0,
        submissions: progress || []
      });
    } catch (err: any) {
      setParentError('Lỗi tra cứu: ' + err.message);
    } finally {
      setParentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 via-amber-50 to-orange-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-4 border-amber-200 p-6 sm:p-8 space-y-5 relative overflow-hidden">
        
        {/* TOP DECORATION */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex p-3 bg-amber-400 text-amber-950 rounded-3xl shadow-md animate-bounce-slow">
            <span className="text-4xl">🧮</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-950 tracking-tight">TOÁN CÙNG EM</h1>
          <p className="text-xs font-bold text-amber-800">Cổng Học Tập & Quản Lý Toán Tiểu Học Lớp 2</p>
        </div>

        {/* AUTH-04: NÚT DÀNH CHO PHỤ HUYNH TRA CỨU TIẾN ĐỘ BẰNG MÃ PIN */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowParentModal(true)}
            className="w-full py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-black rounded-2xl border-2 border-emerald-300 text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Eye className="w-4 h-4 text-emerald-700" />
            👨‍👩‍👧 Phụ Huynh Tra Cứu Tiến Độ Học
          </button>
        </div>

        {/* BƯỚC 1: LỰA CHỌN 3 LOẠI VAI TRÒ (AUTH-03) */}
        <div className="space-y-2">
          <label className="text-xs font-black text-amber-900 uppercase tracking-wider block text-center">
            Vui lòng chọn Vai Trò của bạn:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { setSelectedRole('teacher'); setErrorMsg(''); }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 font-black transition-all ${
                selectedRole === 'teacher'
                  ? 'border-amber-500 bg-amber-100 text-amber-900 shadow-md scale-105'
                  : 'border-amber-200 bg-amber-50/50 text-slate-600 hover:border-amber-300'
              }`}
            >
              <span className="text-2xl mb-1">👩‍🏫</span>
              <span className="text-[11px]">Giáo viên</span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedRole('student'); setErrorMsg(''); }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 font-black transition-all ${
                selectedRole === 'student'
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-900 shadow-md scale-105'
                  : 'border-amber-200 bg-amber-50/50 text-slate-600 hover:border-amber-300'
              }`}
            >
              <span className="text-2xl mb-1">👨‍🎓</span>
              <span className="text-[11px]">Học sinh</span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedRole('admin'); setErrorMsg(''); }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 font-black transition-all ${
                selectedRole === 'admin'
                  ? 'border-purple-500 bg-purple-100 text-purple-900 shadow-md scale-105'
                  : 'border-amber-200 bg-amber-50/50 text-slate-600 hover:border-amber-300'
              }`}
            >
              <span className="text-2xl mb-1">👑</span>
              <span className="text-[11px]">Quản trị</span>
            </button>
          </div>

          {selectedRole === 'admin' && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleQuickFillAdmin}
                className="text-[11px] font-black text-purple-900 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-xl border border-purple-300 inline-flex items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" /> Điền nhanh Admin (ngocngan091002@gmail.com)
              </button>
            </div>
          )}
        </div>

        {/* AUTH-02: NÚT ĐĂNG NHẬP NHANH BẰNG GOOGLE */}
        <div>
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-extrabold py-3 px-4 rounded-2xl border-2 border-slate-200 shadow-sm flex items-center justify-center gap-3 transition-all text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Đăng nhập nhanh bằng Google
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-amber-200"></div>
          <span className="flex-shrink mx-3 text-xs font-bold text-amber-700">hoặc Đăng ký / Đăng nhập Email</span>
          <div className="flex-grow border-t border-amber-200"></div>
        </div>

        {/* AUTH-01: FORM ĐĂNG NHẬP / ĐĂNG KÝ EMAIL */}
        <form onSubmit={handleAuthSubmit} className="space-y-3">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {isSignUp && (
            <>
              <div>
                <label className="text-xs font-bold text-amber-900 mb-1 block">Họ và Tên:</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
                  <input
                    type="text"
                    required
                    placeholder="VD: Huỳnh Phương Bảo Anh"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* AUTH-07: MÃ KÍCH HOẠT VIP / LICENSE GIÁO VIÊN */}
              <div>
                <label className="text-xs font-bold text-amber-900 mb-1 block">
                  Mã Kích Hoạt VIP / Giáo Viên (Nếu có):
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
                  <input
                    type="text"
                    placeholder="Nhập TEACHER2026 hoặc VIP2026..."
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-bold text-amber-900 mb-1 block">Gmail / Tên đăng nhập:</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
              <input
                type="email"
                required
                placeholder="VD: ngocngan091002@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-amber-900 mb-1 block">Mật khẩu:</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-3 rounded-2xl shadow-lg shadow-amber-300 flex items-center justify-center gap-2 text-sm transition-all transform active:scale-95"
          >
            {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Đang xử lý...' : isSignUp ? 'Đăng Ký Tài Khoản Mới' : 'Vào Hệ Thống Học Tập'}
          </button>
        </form>

        {/* CHUYỂN ĐỔI ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }}
            className="text-xs font-black text-amber-800 hover:text-amber-950 underline"
          >
            {isSignUp ? 'Đã có tài khoản? Bấm để Đăng Nhập' : 'Chưa có tài khoản? Bấm để Đăng Ký Mới'}
          </button>
        </div>

      </div>

      {/* AUTH-04: MODAL PHỤ HUYNH TRA CỨU TIẾN ĐỘ BẰNG MÃ PIN (NO ACCOUNT NEEDED) */}
      {showParentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-emerald-200 p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowParentModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 border-b border-emerald-200 pb-3">
              <div className="p-3 bg-emerald-500 text-white rounded-2xl">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">CỔNG TRA CỨU PHỤ HUYNH</h3>
                <p className="text-xs font-bold text-slate-500">Xem báo cáo học tập của con mà không cần tạo tài khoản</p>
              </div>
            </div>

            <form onSubmit={handleParentLookup} className="space-y-3">
              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">Mã Học Sinh:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: HS2026_01"
                  value={parentStudentCode}
                  onChange={(e) => setParentStudentCode(e.target.value)}
                  className="w-full p-2.5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-xs font-extrabold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">Mã PIN Phụ Huynh (Mặc định: 123456):</label>
                <input
                  type="password"
                  required
                  placeholder="••••••"
                  value={parentPin}
                  onChange={(e) => setParentPin(e.target.value)}
                  className="w-full p-2.5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-xs font-extrabold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {parentError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-2xl text-xs font-bold text-rose-800">
                  {parentError}
                </div>
              )}

              <button
                type="submit"
                disabled={parentLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl shadow text-xs flex items-center justify-center gap-1.5"
              >
                <Search className="w-4 h-4" /> {parentLoading ? 'Đang Tra Cứu...' : 'Tra Cứu Báo Cáo Học Tập'}
              </button>
            </form>

            {parentSearchResult && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3 pt-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <h4 className="font-black text-sm text-emerald-950">{parentSearchResult.student.full_name}</h4>
                  <span className="text-[10px] font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-lg">
                    {parentSearchResult.student.student_code}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-extrabold">
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">Nhiệm vụ xong:</span>
                    <span className="text-emerald-700 text-sm">{parentSearchResult.completed_tasks} bài</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">Số bài kiểm tra:</span>
                    <span className="text-emerald-700 text-sm">{parentSearchResult.submissions.length} bài</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
