import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { getAllProfiles, updateUserStatus } from '../../services/supabase';
import { ShieldCheck, UserCheck, UserX, Clock, Users, School, GraduationCap, CheckCircle2 } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string>('');

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
            Quyền hạn cao nhất: Phê duyệt Giáo viên, Quản lý phân quyền & Xem toàn bộ hệ thống
          </p>
        </div>
        <div className="bg-purple-950/60 px-4 py-2 rounded-2xl border border-purple-400 text-xs font-bold text-yellow-300">
          Email Admin: ngocngan091002@gmail.com
        </div>
      </div>

      {actionMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 p-4 rounded-2xl font-black text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {actionMsg}
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
          DANH SÁCH GIÁO VIÊN CHỜ DỤYỆT ({pendingTeachers.length})
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

      {/* TẤT CẢ NGƯỜI DÙNG HỆ THỐNG */}
      <div className="bg-white rounded-3xl border-2 border-amber-200 p-6 shadow-md space-y-4">
        <h3 className="text-lg font-black text-slate-800">TOÀN BỘ DANH SÁCH NGƯỜI DÙNG ({profiles.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-black">
                <th className="p-3 rounded-l-xl">Họ và Tên</th>
                <th className="p-3">Email</th>
                <th className="p-3">Vai trò</th>
                <th className="p-3">Trạng thái</th>
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
                      {p.role.toUpperCase()}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
