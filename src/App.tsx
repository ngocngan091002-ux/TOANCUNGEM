import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { AuthPage } from './pages/AuthPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-amber-50/60 pb-12">
      <Header />
      <main className="transition-all">
        {children}
      </main>
    </div>
  );
};

const MainDashboardRouter: React.FC = () => {
  const { user, loading, activeView } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-amber-700 rounded-full animate-spin mb-4"></div>
        <div className="text-base font-black text-amber-900 animate-pulse">
          Đang tải hệ thống Quản lý Giáo dục & Học liệu... 🧮
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ProtectedLayout>
      {activeView === 'admin' && (user.role === 'admin' ? <AdminDashboard /> : <StudentDashboard />)}
      {activeView === 'teacher' && (user.role === 'teacher' || user.role === 'admin' ? <TeacherDashboard /> : <StudentDashboard />)}
      {activeView === 'student' && <StudentDashboard />}
    </ProtectedLayout>
  );
};

const AdminRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return (
    <ProtectedLayout>
      <AdminDashboard />
    </ProtectedLayout>
  );
};

const TeacherRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return <Navigate to="/" replace />;
  return (
    <ProtectedLayout>
      <TeacherDashboard />
    </ProtectedLayout>
  );
};

const StudentRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <ProtectedLayout>
      <StudentDashboard />
    </ProtectedLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<MainDashboardRouter />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/teacher" element={<TeacherRoute />} />
          <Route path="/student" element={<StudentRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
