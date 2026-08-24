import React, { useEffect, useState } from 'react';
import { UserProfile, UserRole, ClassItem } from '../../types';
import { 
  getAllProfiles, updateUserStatus, supabase, supabaseAdmin, 
  getTeacherClasses, getClassMembers, batchImportStudentsToClass, removeStudentFromClass 
} from '../../services/supabase';
import { parseStudentExcel, exportClassToExcel } from '../../services/excelService';
import { 
  ShieldCheck, UserCheck, UserX, Clock, Users, 
  School, GraduationCap, CheckCircle2, UserPlus, Mail, Lock, User, Phone, X,
  FileSpreadsheet, Upload, Download, Trash2
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string>('');

  // STATE NẠP DỮ LIỆU LỚP HỌC VÀ HỌC SINH CHO ADMIN
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [excelLoading, setExcelLoading] = useState<boolean>(false);

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
    fetchClassesAdmin();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassStudents(selectedClassId);
    }
  }, [selectedClassId]);

  const fetchClassesAdmin = async () => {
    try {
      const cls = await getTeacherClasses('');
      setClasses(cls);
      const targetCls = cls.find(c => c.code === 'ZJ3KYE' || c.name.includes('Lớp Hai 4')) || cls[0];
      if (targetCls) {
        setSelectedClassId(targetCls.id);
        await fetchClassStudents(targetCls.id);
      }
    } catch (err) {
      console.error('Fetch classes admin error:', err);
    }
  };

  const fetchClassStudents = async (classId: string) => {
    try {
      const members = await getClassMembers(classId);
      const stList = members.map(m => m.student).filter(Boolean) as UserProfile[];
      setClassStudents(stList);
    } catch (err) {
      console.error('Fetch class students error:', err);
    }
  };

  // STATE MODAL THÊM 1 HỌC SINH THỦ CÔNG FOR ADMIN
  const [showAddSingleStudentAdminModal, setShowAddSingleStudentAdminModal] = useState<boolean>(false);
  const [singleStudentNameAdmin, setSingleStudentNameAdmin] = useState<string>('');
  const [singleStudentEmailAdmin, setSingleStudentEmailAdmin] = useState<string>('');
  const [singleStudentCodeAdmin, setSingleStudentCodeAdmin] = useState<string>('');
  const [singleStudentPasswordAdmin, setSingleStudentPasswordAdmin] = useState<string>('123456');

  const handleAddSingleStudentAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedClassId || (classes[0] ? classes[0].id : '');
    const targetClass = classes.find(c => c.id === targetId);

    if (!targetId || !singleStudentNameAdmin.trim()) {
      alert('Vui lòng chọn Lớp Học và nhập Họ và Tên học sinh!');
      return;
    }

    try {
      const name = singleStudentNameAdmin.trim();
      const code = singleStudentCodeAdmin.trim() || `HS2026_${classStudents.length + 1}`;
      const pwd = singleStudentPasswordAdmin.trim() || '123456';
      let email = singleStudentEmailAdmin.trim().toLowerCase();

      if (!email) {
        const unsigned = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, '').toLowerCase();
        email = `${unsigned}${Math.floor(100 + Math.random() * 900)}@toancungem.edu.vn`;
      }

      await batchImportStudentsToClass(targetId, [{
        full_name: name,
        email: email,
        student_code: code,
        password: pwd
      }]);

      alert(`🎉 [ADMIN] Đã thêm thành công học sinh "${name}" (Mã: ${code}, Mật khẩu: ${pwd}) vào lớp ${targetClass?.name || 'Lớp Hai 4'}!`);
      setShowAddSingleStudentAdminModal(false);
      setSingleStudentNameAdmin('');
      setSingleStudentEmailAdmin('');
      setSingleStudentCodeAdmin('');
      setSingleStudentPasswordAdmin('123456');
      await fetchClassStudents(targetId);
      await fetchProfiles();
    } catch (err: any) {
      alert('Lỗi thêm học sinh: ' + err.message);
    }
  };

  const handleRemoveStudentAdmin = async (studentId: string, studentName: string) => {
    const targetId = selectedClassId || (classes[0] ? classes[0].id : '');
    const targetClass = classes.find(c => c.id === targetId);
    if (!targetId) return;

    if (!window.confirm(`⚠️ [ADMIN] Thầy/Cô có chắc chắn muốn xóa học sinh "${studentName}" ra khỏi lớp ${targetClass?.name || 'Lớp Hai 4'}?`)) {
      return;
    }

    try {
      const ok = await removeStudentFromClass(targetId, studentId);
      if (ok) {
        alert(`🎉 [ADMIN] Đã xóa học sinh "${studentName}" ra khỏi lớp!`);
        await fetchClassStudents(targetId);
        await fetchProfiles();
      } else {
        alert('Lỗi xóa học sinh. Vui lòng thử lại!');
      }
    } catch (err: any) {
      alert('Lỗi xóa học sinh: ' + err.message);
    }
  };

  const handleImportExcelAdmin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    let targetId = selectedClassId;
    if (!targetId && classes.length > 0) {
      const found = classes.find(c => c.code === 'ZJ3KYE' || c.name.includes('Lớp Hai 4')) || classes[0];
      targetId = found.id;
      setSelectedClassId(targetId);
    }

    if (!targetId) {
      alert('Vui lòng chọn hoặc tạo Lớp Học trước khi nạp Excel!');
      return;
    }

    const file = e.target.files[0];
    const targetClass = classes.find(c => c.id === targetId);
    setExcelLoading(true);

    try {
      const studentList = await parseStudentExcel(file);
      if (!studentList || studentList.length === 0) {
        alert('File Excel không có dữ liệu học sinh hoặc sai định dạng!');
        setExcelLoading(false);
        return;
      }

      const count = await batchImportStudentsToClass(targetId, studentList);
      alert(`🎉 [ADMIN] Đã nạp thành công ${count} / ${studentList.length} học sinh vào lớp ${targetClass?.name || 'Lớp Hai 4'}!`);
      await fetchClassStudents(targetId);
      await fetchProfiles();
    } catch (err: any) {
      alert('Lỗi đọc file Excel: ' + err.message);
    } finally {
      setExcelLoading(false);
      e.target.value = '';
    }
  };

  const handleExportExcelAdmin = () => {
    const targetClass = classes.find(c => c.id === selectedClassId);
    exportClassToExcel(targetClass?.name || 'Lop_Hoc', classStudents);
  };

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
      const { error } = await supabaseAdmin
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

  // TẠO TÀI KHOẢN GIÁO VIÊN MỚI TRỰC TIẾP (BYPASSING RLS BY SUPABASE ADMIN)
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

      // 1. Kiểm tra xem profile email này đã có trong hệ thống chưa
      const { data: existingProf } = await supabaseAdmin
        .from('profiles')
        .select('id, email, role')
        .eq('email', cleanEmail)
        .maybeSingle();

      const targetId = existingProf?.id || crypto.randomUUID();

      // 2. Chèn hoặc cập nhật trực tiếp vào bảng profiles qua Service Role Client (Bypassing RLS 100%)
      const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
        id: targetId,
        email: cleanEmail,
        full_name: teacherName.trim(),
        role: 'teacher',
        status: 'approved',
        phone: teacherPhone.trim()
      }, { onConflict: 'email' });

      if (profErr) {
        // Fallback 1: Cập nhật trực tiếp theo Email nếu upsert bị vướng
        const { error: upErr } = await supabaseAdmin.from('profiles').update({
          full_name: teacherName.trim(),
          role: 'teacher',
          status: 'approved',
          phone: teacherPhone.trim()
        }).eq('email', cleanEmail);

        if (upErr) throw upErr;
      }

      // 3. Khởi tạo auth user ngầm (nếu mở service role admin auth)
      try {
        await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: teacherPassword,
          email_confirm: true,
          user_metadata: {
            full_name: teacherName.trim(),
            role: 'teacher',
            status: 'approved',
            phone: teacherPhone.trim()
          }
        });
      } catch (authErr) {
        console.warn('Auth admin user creation warning:', authErr);
      }

      const newTeacherProf: UserProfile = {
        id: targetId,
        email: cleanEmail,
        full_name: teacherName.trim(),
        role: 'teacher',
        status: 'approved',
        phone: teacherPhone.trim()
      };

      setProfiles(prev => [newTeacherProf, ...prev.filter(p => p.email !== cleanEmail)]);
      setActionMsg(`🎉 Đã kích hoạt thành công tài khoản Giáo viên: ${cleanEmail} (Mật khẩu cấp: ${teacherPassword})!`);
      setShowAddTeacherModal(false);
      setTeacherName('');
      setTeacherEmail('');
      setTeacherPassword('');
      setTeacherPhone('');
      
      await fetchProfiles();
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

      {/* KHU VỰC QUẢN LÝ & NHẬP DANH SÁCH HỌC SINH TỪ EXCEL CHO ADMIN */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl border-4 border-amber-300 p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-amber-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-amber-600" />
              NẠP DANH SÁCH HỌC SINH EXCEL / CSV DÀNH CHO ADMIN
            </h3>
            <p className="text-xs font-bold text-amber-700 mt-1">
              Quản trị viên có thể nhập file Excel danh sách học sinh vào bất kỳ Lớp Học nào trong hệ thống!
            </p>
          </div>

          <div className="flex items-center gap-3">
            {classes.length > 0 && (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-white border-2 border-amber-300 rounded-2xl px-4 py-2.5 text-xs font-black text-amber-900 focus:outline-none focus:border-amber-500 shadow-sm"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Mã: {c.code})</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowAddSingleStudentAdminModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2.5 rounded-2xl shadow flex items-center gap-2 text-xs transition-all"
            >
              <UserPlus className="w-4 h-4" /> Thêm 1 Học Sinh Thủ Công
            </button>

            <label className={`cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-2xl shadow flex items-center gap-2 text-xs transition-all ${excelLoading ? 'opacity-50 cursor-wait' : ''}`}>
              <Upload className="w-4 h-4" />
              {excelLoading ? 'Đang đọc Excel...' : 'Nạp Excel Học Sinh'}
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                disabled={excelLoading}
                onChange={handleImportExcelAdmin}
              />
            </label>
          </div>
        </div>

        {/* BẢNG DANH SÁCH HỌC SINH CỦA LỚP ĐƯỢC CHỌN */}
        <div className="bg-white rounded-2xl border-2 border-amber-200 p-4 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-800">
              DANH SÁCH HỌC SINH TRONG LỚP ({classStudents.length} HỌC SINH):
            </span>
            {classStudents.length > 0 && (
              <button
                onClick={handleExportExcelAdmin}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Xuất File Excel Lớp
              </button>
            )}
          </div>

          {classStudents.length === 0 ? (
            <div className="text-center py-6 text-xs font-bold text-slate-400">
              Lớp học chưa có học sinh nào. Bấm nút "Nạp Excel Học Sinh" ở trên để đưa danh sách học sinh vào lớp!
            </div>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-amber-100 text-amber-900 font-black">
                  <tr>
                    <th className="p-2.5 rounded-l-xl">STT</th>
                    <th className="p-2.5">Mã HS</th>
                    <th className="p-2.5">Họ và Tên</th>
                    <th className="p-2.5">Email / Tên Đăng Nhập</th>
                    <th className="p-2.5 text-center">SĐT Phụ Huynh</th>
                    <th className="p-2.5 text-center">Mật Khẩu Phụ Huynh</th>
                    <th className="p-2.5 text-center rounded-r-xl">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {classStudents.map((st, idx) => (
                    <tr key={st.id || idx} className="hover:bg-amber-50/50 font-bold text-slate-700">
                      <td className="p-2.5 font-black text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-mono text-amber-700">{st.student_code || `HS2026_${idx+1}`}</td>
                      <td className="p-2.5 font-extrabold text-slate-900">{st.full_name}</td>
                      <td className="p-2.5 font-mono text-slate-600">{st.email}</td>
                      <td className="p-2.5 text-center font-mono text-blue-700">{st.phone || '0905180506'}</td>
                      <td className="p-2.5 text-center font-mono text-emerald-700">{st.parent_pin || '123456'}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleRemoveStudentAdmin(st.id, st.full_name)}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-800 font-extrabold px-2.5 py-1 rounded-xl text-[11px] border border-rose-300 transition-all flex items-center gap-1 mx-auto"
                          title="Xóa học sinh này ra khỏi lớp"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa Khỏi Lớp
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                    {p.email.toLowerCase() === 'ngocngan091002@gmail.com' ? (
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 border border-purple-300 rounded-xl font-black text-[11px]">
                        👑 Quản Trị Viên Tối Cao
                      </span>
                    ) : p.role === 'student' ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-black text-[11px] inline-flex items-center gap-1">
                        🎓 Học Sinh (Đã Cố Định)
                      </span>
                    ) : (
                      <div className="inline-flex gap-1.5">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500 text-white shadow">
                          👨‍🏫 Giáo Viên
                        </span>
                        <button
                          onClick={() => handleChangeRole(p.id, 'student')}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition-all border border-emerald-300"
                        >
                          Chuyển Thành Học Sinh
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

      {/* MODAL ADMIN THÊM 1 HỌC SINH THỦ CÔNG */}
      {showAddSingleStudentAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-amber-200 p-6 sm:p-8 w-full max-w-md shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowAddSingleStudentAdminModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800">[ADMIN] THÊM HỌC SINH VÀO LỚP</h3>
              <p className="text-xs font-bold text-slate-500">Quản trị viên nhập Họ tên học sinh để nạp trực tiếp vào {classes.find(c => c.id === selectedClassId)?.name || 'Lớp Hai 4'}</p>
            </div>

            <form onSubmit={handleAddSingleStudentAdmin} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Họ và Tên Học Sinh (*):</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Trần Văn Nam"
                  value={singleStudentNameAdmin}
                  onChange={(e) => setSingleStudentNameAdmin(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mã Học Sinh (tùy chọn):</label>
                <input
                  type="text"
                  placeholder={`Mặc định: HS2026_${classStudents.length + 1}`}
                  value={singleStudentCodeAdmin}
                  onChange={(e) => setSingleStudentCodeAdmin(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email / Tên Đăng Nhập (tùy chọn):</label>
                <input
                  type="email"
                  placeholder="VD: nam.tran@toancungem.edu.vn (tự tạo nếu trống)"
                  value={singleStudentEmailAdmin}
                  onChange={(e) => setSingleStudentEmailAdmin(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mật Khẩu Đăng Nhập / Phụ Huynh (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Mặc định: 123456"
                  value={singleStudentPasswordAdmin}
                  onChange={(e) => setSingleStudentPasswordAdmin(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500 font-mono text-emerald-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSingleStudentAdminModal(false)}
                  className="px-4 py-2.5 rounded-2xl font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl font-black text-xs text-white bg-amber-500 hover:bg-amber-600 shadow-md"
                >
                  Nạp Học Sinh Trực Tiếp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
