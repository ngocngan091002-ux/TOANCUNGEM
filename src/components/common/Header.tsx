import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, ShieldAlert, GraduationCap, School, Eye } from 'lucide-react';
import { ActiveView } from '../../types';

export const Header: React.FC = () => {
  const { user, activeView, setActiveView, logout } = useAuth();

  if (!user) return null;

  const canSwitchToTeacher = user.role === 'teacher' || user.role === 'admin';
  const canSwitchToAdmin = user.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-200 shadow-sm px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* LOGO */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-200">
            <span className="text-2xl font-black">🧮</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-amber-900 tracking-tight flex items-center gap-2">
              TOÁN CÙNG EM
              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-300">
                Khối Lớp 2
              </span>
            </h1>
            <p className="text-xs text-amber-700 font-semibold">Học Toán Tương Tác & Trợ Lý AI Nông Nhiệt</p>
          </div>
        </div>

        {/* ROLE VIEW SWITCHER (CHỈNH XEM LUÂN PHIÊN KHÔNG CẦN CHUYỂN ACC) */}
        <div className="flex items-center gap-1.5 bg-amber-100/80 p-1.5 rounded-2xl border border-amber-300/70 shadow-inner">
          {canSwitchToAdmin && (
            <button
              onClick={() => setActiveView('admin')}
              className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all ${
                activeView === 'admin'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-purple-900 hover:bg-amber-200/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Quản trị viên
            </button>
          )}

          {canSwitchToTeacher && (
            <button
              onClick={() => setActiveView('teacher')}
              className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all ${
                activeView === 'teacher'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-900 hover:bg-amber-200/60'
              }`}
            >
              <School className="w-3.5 h-3.5" />
              Giao diện Giáo viên
            </button>
          )}

          <button
            onClick={() => setActiveView('student')}
            className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all ${
              activeView === 'student'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-900 hover:bg-amber-200/60'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Giao diện Học sinh
            {canSwitchToTeacher && (
              <span className="text-[10px] bg-emerald-700/40 text-emerald-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" /> Xem thử
              </span>
            )}
          </button>
        </div>

        {/* USER PROFILE & LOGOUT */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-amber-50 px-3 py-1.5 rounded-2xl border border-amber-200">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-amber-900 font-black flex items-center justify-center text-sm shadow">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                user.full_name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-black text-slate-800 leading-tight">{user.full_name}</div>
              <div className="text-[10px] font-bold text-amber-700 capitalize">
                {user.role === 'admin' ? '👑 Quản trị viên' : user.role === 'teacher' ? '👩‍🏫 Giáo viên' : '👨‍🎓 Học sinh Lớp 2'}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-200"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

      </div>
    </header>
  );
};
