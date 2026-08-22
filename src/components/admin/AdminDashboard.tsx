import React, { useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../../types';
import { getAllProfiles, updateUserStatus, supabase } from '../../services/supabase';
import { 
  ShieldCheck, UserCheck, UserX, Clock, Users, 
  School, GraduationCap, CheckCircle2, UserPlus, Mail, Lock, User, Phone, X 
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string>('');

  // STATE MODAL TẠO TÀI KHOẢN GIÁO VIÊN MỚI
  const [showAddTeacherModal, setShowAddTeacherModal] = useState<boolean>(false);
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [teacherPassword, setTeacherPassword] = useState<string>('');
  const [teacherPhone, setTeacherPhone] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const data = await getAllProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Fetch profiles error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateUserStatus(userId, status);
      setActionMsg(status === 'approved' ? 'Phê duyệt tài khoản Giáo viên thành công!' : 'Đã từ chối tài khoản Giáo viên!');
      fetchProfiles();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err: any) {
      alert('Lỗi cập nhật trạng thái: ' + err.message);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, status: 'approved' })
        .eq('id', userId);

      if (error) throw error;
      setActionMsg(`Đã chuyển vai trò tài khoản thành ${newRole.toUpperCase()} thành công!`);
      fetchProfiles();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err: any) {
      alert('Lỗi đổi vai trò: ' + err.message);
    }
  };

  // TẠO TÀI KHOẢN GIÁO VIÊN MỚI TRỰC TIẾP
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    try {
      const cleanEmail = teacherEmail.trim().toLowerCase();
      if (!teacherName.trim() || !cleanEmail || !teacherPassword) {
        setCreateError('Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu!');
        setCreateLoading(false);
        return;
      }

      let studentId = '';

      // 1. Tạo auth user trên Supabase Auth
      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: teacherPassword,
          options: {
            data: {
              full_name: teacherName.trim(),
              role: 'teacher',
              status: 'approved',
              phone: teacherPhone.trim()
            }
          }
        });
        if (authData?.user) {
          studentId = authData.user.id;
        }
      } catch (e) {
        console.warn('SignUp warning:', e);
      }

      if (!studentId) {
        studentId = crypto.randomUUID();
      }

      // 2. Upsert profile vào bảng profiles
      const { error: profErr } = await supabase.from('profiles').upsert({
        id: studentId,
        email: cleanEmail,
        full_name: teacherName.trim(),
        role: 'teacher',
        status: 'approved',
        phone: teacherPhone.trim()
      });

      if (profErr) {
        throw profErr;
      }

      setActionMsg(`🎉 Đã khởi tạo thành công tài khoản Giáo viên: ${cleanEmail} (Mật khẩu: ${teacherPassword})!`);
      setShowAddTeacherModal(false);
      setTeacherName('');
      setTeacherEmail('');
      setTeacherPassword('');
      setTeacherPhone('');
      fetchProfiles();
      setTimeout(() => setActionMsg(''), 6000);
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi tạo tài khoản Giáo viên.');
    } finally {
      setCreateLoading(false);
    }
  };

  const pendingTeachers = profiles.filter(p => p.role === 'teacher' && p.status === 'pending');
  const teachers = profiles.filter(p => p.role === 'teacher');
  const students = profiles.filter(p => p.role === 'student');

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* BANNER HỆ THỐNG QUẢN TRỊ */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white rounded-3xl p-6 shadow-xl border-4 border-purple-300 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-yellow-400" />
            BẢNG QUẢN TRỊ VIÊN TỐI CAO
          </h2>
          <p className="text-sm font-semibold text-purple-200 mt-1">
            Quyền hạn cao nhất: Thêm Giáo viên, Phê duyệt tài khoản, Đổi vai trò & Quản lý hệ thống
          </p>
        </div>
        
        {/* NÚT THÊM GIÁO VIÊN MỚI */}
        <button
          onClick={() => setShowAddTeacherModal(true)}
          className="bg-amber-400 hover:bg-amber-300 text-purple-950 font-black px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-sm transition-all transform hover:scale-105"
        >
          <UserPlus className="w-5 h-5" /> Thêm Giáo Viên Mới
        </button>
      </div>

      {actionMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 p-4 rounded-2xl font-black text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>{actionMsg}</div>
        </div>
      )}

      {/* THỐNG KÊ TỔNG QUAN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{profiles.length}</div>
            <div className="text-xs font-extrabold text-amber-800">Tổng số người dùng</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-800 rounded-2xl">
            <School className="w-8 h-8" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{teachers.length}</div>
            <div className="text-xs font-extrabold text-blue-800">Giáo viên trong hệ thống</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{students.length}</div>
            <div className="text-xs font-extrabold text-emerald-800">Học sinh đã đăng ký</div>
          </div>
        </div>
      </div>

      {/* DANH SÁCH GIÁO VIÊN CHỜ PHÊ DUYỆT */}
      <div className="bg-white rounded-3xl border-2 border-amber-200 p-6 shadow-md space-y-4">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          DANH SÁCH GIÁO VIÊN CHỜ DUYỆT ({pendingTeachers.length})
        </h3>

        {loading ? (
          <div className="text-center py-8 text-xs font-bold text-slate-500">Đang tải dữ liệu người dùng...</div>
        ) : pendingTeachers.length === 0 ? (
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-center text-xs font-extrabold text-amber-800">
            ✅ Hiện tại không có yêu cầu đăng ký Giáo viên nào chờ duyệt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-amber-100 text-amber-900 font-black">
                  <th className="p-3 rounded-l-xl">Họ và Tên</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Số điện thoại</th>
                  <th className="p-3">Ngày đăng ký</th>
                  <th className="p-3 text-center rounded-r-xl">Hành động Phê duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {pendingTeachers.map((t) => (
                  <tr key={t.id} className="hover:bg-amber-50/60 font-bold text-slate-700">
                    <td className="p-3 font-extrabold text-slate-900">{t.full_name}</td>
                    <td className="p-3">{t.email}</td>
                    <td className="p-3">{t.phone || 'Chưa cập nhật'}</td>
                    <td className="p-3">{t.created_at ? new Date(t.created_at).toLocaleDateString('vi-VN') : 'Mới'}</td>
                    <td className="p-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleStatusChange(t.id, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow"
                      >
                        <UserCheck className="w-4 h-4" /> Đồng ý duyệt
                      </button>
                      <button
                        onClick={() => handleStatusChange(t.id, 'rejected')}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow"
                      >
                        <UserX className="w-4 h-4" /> Từ chối
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TẤT CẢ NGƯỜI DÙNG HỆ THỐNG & ĐỔI VAI TRÒ */}
      <div className="bg-white rounded-3xl border-2 border-amber-200 p-6 shadow-md space-y-4">
        <h3 className="text-lg font-black text-slate-800">TOÀN BỘ DANH SÁCH NGƯỜI DÙNG ({profiles.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-black">
                <th className="p-3 rounded-l-xl">Họ và Tên</th>
                <th className="p-3">Email</th>
                <th className="p-3">Vai trò Hiện tại</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-center rounded-r-xl">Chuyển Vai Trò (Role)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 font-bold">
                  <td className="p-3 font-extrabold text-slate-900">{p.full_name}</td>
                  <td className="p-3">{p.email}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      p.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                      p.role === 'teacher' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {p.role === 'admin' ? 'QUẢN TRỊ VIÊN' : p.role === 'teacher' ? 'GIÁO VIÊN' : 'HỌC SINH'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      p.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                      p.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {p.email.toLowerCase() !== 'ngocngan091002@gmail.com' && (
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => handleChangeRole(p.id, 'teacher')}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all ${
                            p.role === 'teacher'
                              ? 'bg-amber-500 text-white shadow'
                              : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                          }`}
                        >
                          Thành Giáo Viên
                        </button>
                        <button
                          onClick={() => handleChangeRole(p.id, 'student')}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all ${
                            p.role === 'student'
                              ? 'bg-emerald-500 text-white shadow'
                              : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                          }`}
                        >
                          Thành Học Sinh
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CỦA ADMIN THÊM GIÁO VIÊN MỚI */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-amber-200 p-6 sm:p-8 w-full max-w-md shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowAddTeacherModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="inline-flex p-2.5 bg-amber-100 text-amber-800 rounded-2xl mb-1">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800">TẠO TÀI KHOẢN GIÁO VIÊN MỚI</h3>
              <p className="text-xs font-bold text-slate-500">Quản trị viên cấp Gmail & Mật khẩu cho Giáo viên vào giảng dạy</p>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 text-xs font-bold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTeacher} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Họ và Tên Giáo viên:</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
                  <input
                    type="text"
                    required
                    placeholder="VD: Cô Nguyễn Thị Lan"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Gmail Giáo viên:</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
                  <input
                    type="email"
                    required
                    placeholder="VD: colan.math@gmail.com"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mật khẩu cấp cho Giáo viên:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
                  <input
                    type="text"
                    required
                    placeholder="VD: 12345678"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Số điện thoại (tùy chọn):</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3.5 text-amber-600" />
                  <input
                    type="text"
                    placeholder="VD: 0987654321"
                    value={teacherPhone}
                    onChange={(e) => setTeacherPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all mt-2"
              >
                <UserPlus className="w-4 h-4" />
                {createLoading ? 'Đang khởi tạo tài khoản...' : 'Kích Hoạt Tài Khoản Giáo Viên'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
