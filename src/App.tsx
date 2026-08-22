import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { AuthPage } from './pages/AuthPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';

const MainContent: React.FC = () => {
  const { user, loading, activeView } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-amber-700 rounded-full animate-spin mb-4"></div>
        <div className="text-base font-black text-amber-900 animate-pulse">
          Đang tải hệ thống Toán Cùng Em... 🧮
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-amber-50/60 pb-12">
      <Header />
      <main className="transition-all">
        {activeView === 'admin' && (user.role === 'admin' ? <AdminDashboard /> : <StudentDashboard />)}
        {activeView === 'teacher' && (user.role === 'teacher' || user.role === 'admin' ? <TeacherDashboard /> : <StudentDashboard />)}
        {activeView === 'student' && <StudentDashboard />}
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
