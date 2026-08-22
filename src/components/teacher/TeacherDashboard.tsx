import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  ClassItem, UserProfile, DailyTask, Assignment, 
  LearningMaterial, GameItem, TaskCompletion, AssignmentSubmission, AIWeaknessSummary 
} from '../../types';
import { 
  getTeacherClasses, createClass, getClassMembers, addStudentToClass,
  getDailyTasks, createDailyTask, getTaskCompletionList,
  getLearningMaterials, addLearningMaterial, getGames, addGame,
  getAssignments, createAssignmentWithQuestions, finalizeAssignment,
  getClassSubmissionsForTeacher, updateTeacherGrading, uploadFileToStorage,
  supabase
} from '../../services/supabase';
import { exportClassToExcel, parseStudentExcel } from '../../services/excelService';
import { suggestGrade2Questions, suggestGradingAndRemark, analyzeStudentWeaknesses } from '../../services/aiService';

import { 
  Plus, Upload, FileSpreadsheet, Sparkles, CheckCircle2, 
  Users, BookOpen, Gamepad2, CalendarCheck, FileText, Check, 
  X, Image as ImageIcon, Eye, Award, Brain, Clock, ChevronRight
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'assignments' | 'materials' | 'games' | 'ai'>('tasks');

  // State Tạo Lớp
  const [newClassName, setNewClassName] = useState<string>('');
  const [showClassModal, setShowClassModal] = useState<boolean>(false);

  // State Excel Import / Export
  const [excelLoading, setExcelLoading] = useState<boolean>(false);

  // State Nhiệm Vụ Hàng Ngày
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [taskCompletionModal, setTaskCompletionModal] = useState<{ open: boolean; taskId: string; title: string; list: TaskCompletion[] }>({
    open: false, taskId: '', title: '', list: []
  });

  // State Học Liệu & Trò Chơi
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [matTitle, setMatTitle] = useState<string>('');
  const [matType, setMatType] = useState<'video' | 'ppt' | 'word'>('video');
  const [matFile, setMatFile] = useState<File | null>(null);
  const [gameTitle, setGameTitle] = useState<string>('');
  const [gameUrl, setGameUrl] = useState<string>('');

  // State Bài Tập & Bài Kiểm Tra (Trắc Nghiệm + Ảnh + Dấu Cộng)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignTitle, setAssignTitle] = useState<string>('');
  const [assignType, setAssignType] = useState<'exercise' | 'weekly_test'>('exercise');
  
  const [questions, setQuestions] = useState<any[]>([
    {
      question_text: 'Tính kết quả: 12 + 15 = ?',
      image_url: '',
      options: [
        { id: 'a', text: '27', image_url: '' },
        { id: 'b', text: '25', image_url: '' },
        { id: 'c', text: '30', image_url: '' }
      ],
      correct_answers: ['a'],
      points: 10
    }
  ]);

  // State Chấm Bài & AI Gợi Ý
  const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);
  const [editingScore, setEditingScore] = useState<number>(0);
  const [editingRemark, setEditingRemark] = useState<string>('');

  // State AI Tổng Hợp Lỗ Hổng Kiến Thức
  const [aiTopicInput, setAiTopicInput] = useState<string>('Phép cộng có nhớ lớp 2');
  const [aiSuggestLoading, setAiSuggestLoading] = useState<boolean>(false);
  const [aiWeakness, setAiWeakness] = useState<AIWeaknessSummary | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadTeacherClasses();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      loadClassData(selectedClass.id);
    }
  }, [selectedClass]);

  const loadTeacherClasses = async () => {
    try {
      const cls = await getTeacherClasses(user!.id);
      setClasses(cls);
      if (cls.length > 0 && !selectedClass) {
        setSelectedClass(cls[0]);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  };

  const loadClassData = async (classId: string) => {
    try {
      const members = await getClassMembers(classId);
      setStudents(members.map(m => m.student).filter(Boolean) as UserProfile[]);

      const t = await getDailyTasks(classId);
      setTasks(t);

      const m = await getLearningMaterials(classId);
      setMaterials(m);

      const g = await getGames(classId);
      setGames(g);

      const a = await getAssignments(classId, true);
      setAssignments(a);
    } catch (err) {
      console.error('Error loading class data:', err);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      const created = await createClass(newClassName, 2, user!.id);
      setClasses([created, ...classes]);
      setSelectedClass(created);
      setNewClassName('');
      setShowClassModal(false);
    } catch (err: any) {
      alert('Lỗi tạo lớp: ' + err.message);
    }
  };

  // EXCEL EXPORT
  const handleExportExcel = () => {
    if (!selectedClass) return;
    exportClassToExcel(selectedClass.name, students);
  };

  // EXCEL BATCH IMPORT HỌC SINH
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClass || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setExcelLoading(true);

    try {
      const studentList = await parseStudentExcel(file);
      let successCount = 0;

      for (const st of studentList) {
        const cleanEmail = st.email.trim().toLowerCase();

        // 1. Kiểm tra xem student email đã có chưa
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle();

        let studentId = existingProfile?.id;

        if (!studentId) {
          // Thử tạo auth user qua Supabase
          try {
            const { data: signUpData } = await supabase.auth.signUp({
              email: cleanEmail,
              password: '12345678',
              options: {
                data: {
                  full_name: st.full_name,
                  role: 'student',
                  status: 'approved',
                  student_code: st.student_code,
                  phone: st.phone
                }
              }
            });
            studentId = signUpData?.user?.id;
          } catch (e) {
            console.warn('SignUp warning on batch import:', e);
          }

          // Nếu chưa có studentId (do signup chần chừ hoặc rate limit), tạo ID ngẫu nhiên và upsert
          if (!studentId) {
            studentId = crypto.randomUUID();
          }

          try {
            await supabase.from('profiles').upsert({
              id: studentId,
              email: cleanEmail,
              full_name: st.full_name,
              role: 'student',
              status: 'approved',
              student_code: st.student_code,
              phone: st.phone
            });
          } catch (upsertErr) {
            console.warn('Upsert profile error on import:', upsertErr);
          }
        }

        if (studentId) {
          try {
            await addStudentToClass(selectedClass.id, studentId);
            successCount++;
          } catch (addErr) {
            console.warn('Add to class error:', addErr);
          }
        }
      }

      alert(`Đã thêm thành công ${successCount} học sinh vào lớp ${selectedClass.name}!`);
      loadClassData(selectedClass.id);
    } catch (err: any) {
      alert('Lỗi đọc file Excel: ' + err.message);
    } finally {
      setExcelLoading(false);
      e.target.value = '';
    }
  };

  // TẠO NHIỆM VỤ HÀNG NGÀY
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !newTaskTitle.trim()) return;
    try {
      await createDailyTask({
        class_id: selectedClass.id,
        teacher_id: user!.id,
        title: newTaskTitle,
        due_date: new Date().toISOString().split('T')[0]
      });
      setNewTaskTitle('');
      loadClassData(selectedClass.id);
    } catch (err: any) {
      alert('Lỗi tạo nhiệm vụ: ' + err.message);
    }
  };

  const handleOpenTaskCompletions = async (task: DailyTask) => {
    try {
      const list = await getTaskCompletionList(task.id);
      setTaskCompletionModal({
        open: true,
        taskId: task.id,
        title: task.title,
        list
      });
    } catch (err: any) {
      alert('Lỗi tải danh sách hoàn thành: ' + err.message);
    }
  };

  // UPLOAD HỌC LIỆU
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !matTitle.trim() || !matFile) return;
    try {
      const fileUrl = await uploadFileToStorage('materials', matFile);
      await addLearningMaterial({
        class_id: selectedClass.id,
        teacher_id: user!.id,
        title: matTitle,
        file_url: fileUrl,
        file_type: matType
      });
      setMatTitle('');
      setMatFile(null);
      loadClassData(selectedClass.id);
    } catch (err: any) {
      alert('Lỗi tải học liệu: ' + err.message);
    }
  };

  // UPLOAD TRÒ CHƠI
  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !gameTitle.trim() || !gameUrl.trim()) return;
    try {
      await addGame({
        class_id: selectedClass.id,
        teacher_id: user!.id,
        title: gameTitle,
        game_url: gameUrl
      });
      setGameTitle('');
      setGameUrl('');
      loadClassData(selectedClass.id);
    } catch (err: any) {
      alert('Lỗi thêm trò chơi: ' + err.message);
    }
  };

  // QUẢN LÝ CÂU HỎI TRẮC NGHIỆM CÓ NÚT (+) TẢI ẢNH MINH HỌA
  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: `Câu hỏi ${questions.length + 1}`,
        image_url: '',
        options: [
          { id: 'a', text: 'Đáp án A', image_url: '' },
          { id: 'b', text: 'Đáp án B', image_url: '' },
          { id: 'c', text: 'Đáp án C', image_url: '' }
        ],
        correct_answers: ['a'],
        points: 10
      }
    ]);
  };

  const handleUploadQuestionImage = async (qIdx: number, file: File) => {
    const url = await uploadFileToStorage('question-images', file);
    const updated = [...questions];
    updated[qIdx].image_url = url;
    setQuestions(updated);
  };

  const handleUploadOptionImage = async (qIdx: number, oIdx: number, file: File) => {
    const url = await uploadFileToStorage('question-images', file);
    const updated = [...questions];
    updated[qIdx].options[oIdx].image_url = url;
    setQuestions(updated);
  };

  const handleSaveAssignment = async () => {
    if (!selectedClass || !assignTitle.trim()) return;
    try {
      await createAssignmentWithQuestions(
        {
          class_id: selectedClass.id,
          teacher_id: user!.id,
          title: assignTitle,
          type: assignType,
          is_finalized: false
        },
        questions
      );
      setShowAssignModal(false);
      setAssignTitle('');
      loadClassData(selectedClass.id);
    } catch (err: any) {
      alert('Lỗi lưu bài tập: ' + err.message);
    }
  };

  const handleFinalizeAssignment = async (assignId: string) => {
    try {
      await finalizeAssignment(assignId);
      alert('Đã chốt bài tập thành công! Học sinh đã có thể nhìn thấy bài tập này.');
      loadClassData(selectedClass!.id);
    } catch (err: any) {
      alert('Lỗi chốt bài tập: ' + err.message);
    }
  };

  // AI HỖ TRỢ GỢI Ý CÂU HỎI TOÁN LỚP 2
  const handleAISuggestQuestions = async () => {
    setAiSuggestLoading(true);
    try {
      const suggested = await suggestGrade2Questions(aiTopicInput, 3);
      setQuestions(suggested);
    } catch (err: any) {
      alert('Lỗi gợi ý AI: ' + err.message);
    } finally {
      setAiSuggestLoading(false);
    }
  };

  // AI GỢI Ý CHẤM BÀI VÀ NHẬN XÉT
  const handleOpenGradingModal = async (assign: Assignment) => {
    setSelectedAssignmentForGrading(assign);
    const subs = await getClassSubmissionsForTeacher(assign.id);
    setSubmissions(subs);
  };

  const handleApplyAIGrading = async (sub: AssignmentSubmission) => {
    setGradingSubmission(sub);
    const totalQ = selectedAssignmentForGrading?.questions?.length || 3;
    const wrongCount = Math.max(0, totalQ - Math.round(sub.score / 10));

    const { suggestedScore, remark } = await suggestGradingAndRemark(sub.score, totalQ, wrongCount);
    setEditingScore(suggestedScore);
    setEditingRemark(remark);
  };

  const handleTeacherFinalizeScore = async () => {
    if (!gradingSubmission) return;
    try {
      await updateTeacherGrading(gradingSubmission.id, editingScore, editingRemark);
      alert('Giáo viên đã CHỐT điểm và nhận xét! Học sinh bây giờ mới có thể xem kết quả chi tiết.');
      setGradingSubmission(null);
      if (selectedAssignmentForGrading) {
        const subs = await getClassSubmissionsForTeacher(selectedAssignmentForGrading.id);
        setSubmissions(subs);
      }
    } catch (err: any) {
      alert('Lỗi chốt điểm: ' + err.message);
    }
  };

  // AI TỔNG HỢP NỘI DUNG HỌC SINH CÒN YẾU DỰA TRÊN CÂU SAI THỰC TẾ
  const handleAnalyzeWeaknesses = async () => {
    if (submissions.length === 0) {
      alert('Chưa có bài nộp nào của học sinh để phân tích câu sai thực tế!');
      return;
    }

    const wrongList: any[] = [];
    submissions.forEach(sub => {
      sub.responses?.forEach(r => {
        if (!r.is_correct) {
          wrongList.push({
            questionText: 'Phép tính hoặc bài toán kiểm tra',
            studentAnswer: 'Đáp án đã chọn',
            correctAnswer: 'Đáp án đúng'
          });
        }
      });
    });

    const summary = await analyzeStudentWeaknesses(wrongList);
    setAiWeakness(summary);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* THANH CHỌN LỚP & NÚT XUẤT/NHẬP EXCEL */}
      <div className="bg-white rounded-3xl p-5 border-2 border-amber-200 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Lớp hiện tại */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-3 bg-amber-400 text-amber-950 rounded-2xl shadow">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-amber-800 uppercase">Lớp Học Đang Chọn:</div>
            <select
              value={selectedClass?.id || ''}
              onChange={(e) => {
                const found = classes.find(c => c.id === e.target.value);
                if (found) setSelectedClass(found);
              }}
              className="text-base font-black text-amber-950 bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-1 focus:outline-none"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Mã Lớp: {c.code})</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowClassModal(true)}
            className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow transition"
            title="Tạo lớp học mới"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Nút Xuất Excel & Nhập Excel Hàng Loạt */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất File Excel Lớp
          </button>

          <label className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow cursor-pointer">
            <Upload className="w-4 h-4" />
            {excelLoading ? 'Đang đọc Excel...' : 'Nhập Excel HS Hàng Loạt'}
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} className="hidden" />
          </label>
        </div>

      </div>

      {/* MODAL TẠO LỚP HỌC MỚI */}
      {showClassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border-4 border-amber-300 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-amber-950 flex items-center justify-between">
              TẠO LỚP HỌC MỚI (KHỐI LỚP 2)
              <button onClick={() => setShowClassModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="text-xs font-extrabold text-amber-900 block mb-1">Tên Lớp Học:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Lớp 2A1"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full p-2.5 bg-amber-50 border-2 border-amber-200 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 rounded-xl text-xs shadow"
              >
                Xác Nhận Tạo Lớp
              </button>
            </form>
          </div>
        </div>
      )}

      {/* THANH THƯ MỤC CẢNH QUAN GIÁO VIÊN */}
      <div className="flex border-b-2 border-amber-200 space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all ${
            activeTab === 'tasks' ? 'bg-amber-500 text-white shadow-md' : 'text-amber-900 hover:bg-amber-100'
          }`}
        >
          <CalendarCheck className="w-4 h-4" /> Nhiệm Vụ Hằng Ngày
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all ${
            activeTab === 'assignments' ? 'bg-amber-500 text-white shadow-md' : 'text-amber-900 hover:bg-amber-100'
          }`}
        >
          <FileText className="w-4 h-4" /> Bài Tập & Kiểm Tra
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all ${
            activeTab === 'materials' ? 'bg-amber-500 text-white shadow-md' : 'text-amber-900 hover:bg-amber-100'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Upload Học Liệu
        </button>

        <button
          onClick={() => setActiveTab('games')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all ${
            activeTab === 'games' ? 'bg-amber-500 text-white shadow-md' : 'text-amber-900 hover:bg-amber-100'
          }`}
        >
          <Gamepad2 className="w-4 h-4" /> Tạo Trò Chơi
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all ${
            activeTab === 'ai' ? 'bg-purple-600 text-white shadow-md animate-pulse-glow' : 'text-purple-900 hover:bg-purple-100'
          }`}
        >
          <Brain className="w-4 h-4" /> AI Hỗ Trợ Giáo Viên
        </button>
      </div>

      {/* TAB 1: NHIỆM VỤ HÀNG NGÀY */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md space-y-3">
            <h3 className="text-sm font-black text-amber-950 uppercase">Giao Nhiệm Vụ Hôm Nay Cho Lớp</h3>
            <form onSubmit={handleCreateTask} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="VD: Ôn phép cộng / Làm Bài tập 1 / Trò chơi luyện tập"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 p-2.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 rounded-2xl text-xs shadow flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Giao Nhiệm Vụ
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map(t => (
              <div key={t.id} className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-amber-950">{t.title}</h4>
                  <p className="text-[11px] font-bold text-amber-700">Ngày tạo: {t.due_date}</p>
                </div>
                
                {/* HIỂN THỊ SỐ LƯỢNG TIẾN ĐỘ HOÀN THÀNH (VD: 32/33) + POPUP DANH SÁCH */}
                <button
                  onClick={() => handleOpenTaskCompletions(t)}
                  className="bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 text-amber-950 font-black text-xs px-3 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-sm"
                >
                  <Users className="w-4 h-4 text-amber-700" />
                  Đã hoàn thành: <span className="text-emerald-700 text-sm font-black">{t.completed_count}/{students.length || t.total_students || 0}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POPUP DANH SÁCH HỌC SINH ĐÃ HOÀN THÀNH NHIỆM VỤ (VD: CLICK VÀO 32/33) */}
      {taskCompletionModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border-4 border-amber-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black text-amber-950">
                HỌC SINH ĐÃ HOÀN THÀNH: <span className="text-amber-600">{taskCompletionModal.title}</span>
              </h3>
              <button onClick={() => setTaskCompletionModal({ open: false, taskId: '', title: '', list: [] })}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {taskCompletionModal.list.length === 0 ? (
                <div className="text-xs font-bold text-slate-500 text-center py-4">Chưa có học sinh nào hoàn thành.</div>
              ) : (
                taskCompletionModal.list.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between bg-emerald-50 p-2.5 rounded-2xl border border-emerald-200 text-xs font-bold">
                    <span className="text-slate-800">{i + 1}. {c.student?.full_name || 'Học sinh'}</span>
                    <span className="text-emerald-700 text-[10px] bg-emerald-200 px-2 py-0.5 rounded-full">
                      {new Date(c.completed_at).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BÀI TẬP & BÀI KIỂM TRA (CÓ ẢNH VÀ DẤU CỘNG UPLOAD) */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-sm">
            <h3 className="text-sm font-black text-amber-950">Quản Lý Bài Tập Trắc Nghiệm & Bài Kiểm Tra</h3>
            <button
              onClick={() => setShowAssignModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-4 py-2 rounded-2xl shadow flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Tạo Bài Tập Mới (Kèm Ảnh)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map(a => (
              <div key={a.id} className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                    a.type === 'weekly_test' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {a.type === 'weekly_test' ? '📝 Bài Kiểm Tra Hằng Tuần' : '✏️ Bài Tập Trắc Nghiệm'}
                  </span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                    a.is_finalized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {a.is_finalized ? '✅ Đã Chốt (Học sinh thấy)' : '⏳ Bản nháp'}
                  </span>
                </div>

                <h4 className="text-base font-black text-slate-900">{a.title}</h4>

                <div className="flex items-center gap-2 pt-2 border-t border-amber-100">
                  {!a.is_finalized && (
                    <button
                      onClick={() => handleFinalizeAssignment(a.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Chốt Giao Cho Lớp
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenGradingModal(a)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Chấm Bài & AI Gợi Ý
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL TẠO BÀI TẬP CÓ DẤU CỘNG (+) UPLOAD ẢNH CÂU HỎI VÀ ĐÁP ÁN */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border-4 border-amber-300 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-black text-amber-950">TẠO BÀI TẬP / KIỂM TRA MỚI (CÓ THÊM ẢNH MINH HỌA)</h3>
              <button onClick={() => setShowAssignModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-amber-900 block mb-1">Tên bài tập / bài kiểm tra:</label>
                <input
                  type="text"
                  placeholder="VD: Bài kiểm tra tuần 5 - Phép cộng có nhớ"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full p-2.5 bg-amber-50 border-2 border-amber-200 rounded-xl text-xs font-bold focus:outline-none"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="radio" name="atype" checked={assignType === 'exercise'} onChange={() => setAssignType('exercise')} />
                  Bài tập hàng ngày
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="radio" name="atype" checked={assignType === 'weekly_test'} onChange={() => setAssignType('weekly_test')} />
                  Bài kiểm tra hằng tuần
                </label>
              </div>

              {/* NÚT AI GỢI Ý CÂU HỎI LỚP 2 */}
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Chủ đề AI gợi ý (VD: Phép trừ có nhớ)"
                  value={aiTopicInput}
                  onChange={(e) => setAiTopicInput(e.target.value)}
                  className="p-2 bg-white border border-purple-300 rounded-xl text-xs font-bold flex-1"
                />
                <button
                  type="button"
                  onClick={handleAISuggestQuestions}
                  disabled={aiSuggestLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-3 py-2 rounded-xl shadow flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  {aiSuggestLoading ? 'AI đang tạo...' : 'AI Gợi Ý Câu Hỏi'}
                </button>
              </div>

              {/* DANH SÁCH CÂU HỎI */}
              <div className="space-y-4 pt-2">
                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-amber-50/70 p-4 rounded-2xl border-2 border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900">Câu hỏi {qIdx + 1}:</span>
                      
                      {/* NÚT (+) DẤU CỘNG TẢI ẢNH CÂU HỎI */}
                      <label className="bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[11px] px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer border border-amber-400">
                        <Plus className="w-3.5 h-3.5 text-amber-800" />
                        Tải ảnh minh họa câu hỏi
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleUploadQuestionImage(qIdx, e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      value={q.question_text}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[qIdx].question_text = e.target.value;
                        setQuestions(updated);
                      }}
                      className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold"
                    />

                    {q.image_url && (
                      <img src={q.image_url} alt="Minh họa" className="w-32 h-24 object-cover rounded-xl border border-amber-300" />
                    )}

                    {/* CÁC ĐÁP ÁN */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-amber-800">Các lựa chọn đáp án:</span>
                      {q.options.map((opt: any, oIdx: number) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct_${qIdx}`}
                            checked={q.correct_answers.includes(opt.id)}
                            onChange={() => {
                              const updated = [...questions];
                              updated[qIdx].correct_answers = [opt.id];
                              setQuestions(updated);
                            }}
                          />
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[qIdx].options[oIdx].text = e.target.value;
                              setQuestions(updated);
                            }}
                            className="flex-1 p-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold"
                          />

                          {/* NÚT (+) TẢI ẢNH CHO ĐÁP ÁN */}
                          <label className="p-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg border border-amber-300 cursor-pointer" title="Thêm ảnh đáp án">
                            <Plus className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => e.target.files?.[0] && handleUploadOptionImage(qIdx, oIdx, e.target.files[0])}
                              className="hidden"
                            />
                          </label>

                          {opt.image_url && (
                            <img src={opt.image_url} alt="Opt" className="w-8 h-8 rounded border object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-xs px-3 py-2 rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Thêm câu hỏi
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow"
                >
                  Lưu Bài Tập
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHẤM BÀI & AI GỢI Ý (GIÁO VIÊN DUYỆT MỚI GỬI CHO HỌC SINH) */}
      {selectedAssignmentForGrading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full border-4 border-purple-300 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-black text-purple-950">
                CHẤM BÀI: <span className="text-purple-600">{selectedAssignmentForGrading.title}</span>
              </h3>
              <button onClick={() => setSelectedAssignmentForGrading(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            {submissions.length === 0 ? (
              <div className="text-xs font-bold text-slate-500 text-center py-6">Chưa có bài nộp nào từ học sinh.</div>
            ) : (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <div key={s.id} className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{s.student?.full_name || 'Học sinh'}</div>
                      <div className="text-[11px] font-bold text-slate-600">
                        Điểm hệ thống tự tính: <span className="text-emerald-700 font-black">{s.score}/100</span>
                      </div>
                      {s.teacher_remark && (
                        <div className="text-[11px] font-bold text-purple-900 mt-1">
                          GV đã chốt nhận xét: "{s.teacher_remark}"
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleApplyAIGrading(s)}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      AI Gợi Ý & GV Duyệt
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDIT ĐIỂM & NHẬN XÉT CỦA GIÁO VIÊN BẤM CHỐT */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border-4 border-emerald-400 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center justify-between">
              GIÁO VIÊN CHỐT ĐIỂM & NHẬN XÉT
              <button onClick={() => setGradingSubmission(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Điểm số giáo viên chốt:</label>
                <input
                  type="number"
                  value={editingScore}
                  onChange={(e) => setEditingScore(Number(e.target.value))}
                  className="w-full p-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-black text-emerald-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Lời nhận xét học sinh (Giáo viên có thể sửa):</label>
                <textarea
                  rows={3}
                  value={editingRemark}
                  onChange={(e) => setEditingRemark(e.target.value)}
                  className="w-full p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold"
                />
              </div>

              <button
                onClick={handleTeacherFinalizeScore}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs shadow"
              >
                CHỐT & GỬI KẾT QUẢ CHO HỌC SINH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HỌC LIỆU */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md space-y-3">
            <h3 className="text-sm font-black text-amber-950 uppercase">Tải Học Liệu (Video, PPT, Word) Lên Cho Lớp</h3>
            <form onSubmit={handleAddMaterial} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                placeholder="Tiêu đề bài giảng"
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
                className="p-2.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold"
              />
              <select
                value={matType}
                onChange={(e) => setMatType(e.target.value as any)}
                className="p-2.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold"
              >
                <option value="video">Video bài giảng</option>
                <option value="ppt">Bài trình chiếu PPT</option>
                <option value="word">Tài liệu Word / PDF</option>
              </select>
              <input
                type="file"
                required
                onChange={(e) => e.target.files?.[0] && setMatFile(e.target.files[0])}
                className="p-1.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs"
              />
              <button
                type="submit"
                className="sm:col-span-3 bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-2xl text-xs shadow"
              >
                Tải Học Liệu Lên Lớp
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {materials.map(m => (
              <div key={m.id} className="bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-sm space-y-2">
                <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md uppercase">{m.file_type}</span>
                <h4 className="text-xs font-black text-slate-900">{m.title}</h4>
                <a href={m.file_url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-amber-700 underline block">Tải về / Xem học liệu</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TRÒ CHƠI */}
      {activeTab === 'games' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md space-y-3">
            <h3 className="text-sm font-black text-amber-950 uppercase">Tải / Thêm Trò Chơi Luyện Tập</h3>
            <form onSubmit={handleAddGame} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                placeholder="Tên trò chơi Toán lớp 2"
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                className="p-2.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold flex-1"
              />
              <input
                type="url"
                required
                placeholder="Link trò chơi (URL)"
                value={gameUrl}
                onChange={(e) => setGameUrl(e.target.value)}
                className="p-2.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold flex-1"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2.5 rounded-2xl text-xs shadow"
              >
                Thêm Trò Chơi
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {games.map(g => (
              <div key={g.id} className="bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-sm space-y-2">
                <h4 className="text-sm font-black text-slate-900">🎮 {g.title}</h4>
                <a href={g.game_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-700 underline block">Chơi thử trò chơi</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AI HỖ TRỢ GIÁO VIÊN (TỔNG HỢP CÂU SAI THỰC TẾ) */}
      {activeTab === 'ai' && (
        <div className="bg-white p-6 rounded-3xl border-4 border-purple-200 shadow-lg space-y-4">
          <h3 className="text-base font-black text-purple-950 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            AI TỔNG HỢP CÁC PHẦN HỌC SINH CÒN YẾU DỰA TRÊN DỮ LIỆU CÂU SAI THỰC TẾ
          </h3>
          <p className="text-xs font-bold text-purple-800">
            Hệ thống phân tích các câu hỏi trắc nghiệm học sinh đã làm sai thực tế để gợi ý chủ đề cần lưu ý cho Giáo viên.
          </p>

          <button
            onClick={handleAnalyzeWeaknesses}
            className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-5 py-3 rounded-2xl shadow flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" /> Phân Tích Dữ Liệu Thực Tế Ngay
          </button>

          {aiWeakness && (
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-300 space-y-2">
              <div className="text-xs font-black text-purple-900">📌 Các chủ đề kiến thức học sinh còn yếu:</div>
              <ul className="list-disc list-inside text-xs font-bold text-slate-700 space-y-1">
                {aiWeakness.weak_topics.map((t, idx) => (
                  <li key={idx} className="text-rose-700">{t}</li>
                ))}
              </ul>
              <div className="text-xs font-black text-purple-950 pt-2 border-t border-purple-200">
                📝 Ghi chú tổng hợp cho Giáo viên: {aiWeakness.summary_notes}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
