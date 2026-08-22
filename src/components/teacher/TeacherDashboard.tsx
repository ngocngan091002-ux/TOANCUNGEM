import React, { useEffect, useState } from 'react';
import { UserProfile, ClassItem, LearningMaterial, GameItem, DailyTask, Assignment } from '../../types';
import { 
  getTeacherClasses, createClass, getClassMembers, 
  getDailyTasks, createDailyTask, 
  getLearningMaterials, addLearningMaterial, getGames, addGame, 
  getAssignments, createAssignmentWithQuestions, 
  getClassSubmissionsForTeacher, updateTeacherGrading, uploadFileToStorage, 
  batchImportStudentsToClass, supabase 
} from '../../services/supabase';
import { exportClassToExcel, parseStudentExcel } from '../../services/excelService';
import { suggestGrade2Questions, suggestGradingAndRemark, analyzeStudentWeaknesses } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Users, BookOpen, Gamepad2, 
  Sparkles, CheckCircle2, Upload, 
  Download, Image as ImageIcon, RefreshCw, Brain
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Modal & Tab State
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('tasks');

  // Class Content Data
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Task Form
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');

  // Material Form
  const [matTitle, setMatTitle] = useState<string>('');
  const [matDesc, setMatDesc] = useState<string>('');
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matType, setMatType] = useState<'video' | 'ppt' | 'word' | 'image' | 'other'>('ppt');
  const [matUploading, setMatUploading] = useState<boolean>(false);

  // Game Form
  const [gameTitle, setGameTitle] = useState<string>('');
  const [gameDesc, setGameDesc] = useState<string>('');
  const [gameUrl, setGameUrl] = useState<string>('');

  // Assignment & AI Form
  const [assignTitle, setAssignTitle] = useState<string>('');
  const [assignType, setAssignType] = useState<'exercise' | 'weekly_test'>('exercise');
  const [aiTopic, setAiTopic] = useState<string>('Phép cộng trong phạm vi 100 (có nhớ)');
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(5);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const [draftQuestions, setDraftQuestions] = useState<{
    question_text: string;
    image_url?: string;
    options: { id: string; text: string }[];
    correct_answers: string[];
  }[]>([]);

  // AI Chấm Bài & Phân Tích Lỗi Sai Real-time
  const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState<Assignment | null>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string>('');
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [excelLoading, setExcelLoading] = useState<boolean>(false);

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

  // EXCEL BATCH IMPORT HỌC SINH (33+ HỌC SINH 1-CLICK SUCCESS)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClass || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setExcelLoading(true);

    try {
      const studentList = await parseStudentExcel(file);
      if (!studentList || studentList.length === 0) {
        alert('File Excel không có dữ liệu học sinh hoặc sai định dạng!');
        setExcelLoading(false);
        return;
      }

      // Gọi hàm batchImportStudentsToClass dùng Service Role Client (Bypassing RLS)
      const count = await batchImportStudentsToClass(selectedClass.id, studentList);

      alert(`🎉 Đã thêm thành công ${count} / ${studentList.length} học sinh vào lớp ${selectedClass.name}!`);
      loadClassData(selectedClass.id);
    } catch (err: any) {
      alert('Lỗi đọc file Excel: ' + err.message);
    } finally {
      setExcelLoading(false);
      e.target.value = '';
    }
  };

  // TẠO NHIỆM VỤ HÀNG NGÀY VỚI THÔNG BÁO VÀ GỢI Ý MẪU 1-CLICK
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      alert('Vui lòng gõ tên nhiệm vụ (hoặc bấm chọn 1 gợi ý mẫu bên dưới) trước khi bấm Giao Nhiệm Vụ nhé!');
      return;
    }
    if (!selectedClass) {
      alert('Vui lòng chọn hoặc tạo lớp học trước khi giao nhiệm vụ!');
      return;
    }

    try {
      const task = await createDailyTask({
        class_id: selectedClass.id,
        teacher_id: user!.id,
        title: newTaskTitle.trim(),
        due_date: new Date().toISOString().split('T')[0]
      });

      setTasks([task, ...tasks]);
      setNewTaskTitle('');
      alert(`🎉 Đã giao thành công nhiệm vụ "${task.title}" cho lớp ${selectedClass.name}!`);
    } catch (err: any) {
      alert('Lỗi tạo nhiệm vụ: ' + err.message);
    }
  };

  // UPLOAD HỌC LIỆU
  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !matTitle.trim() || !matFile) return;

    setMatUploading(true);
    try {
      const fileUrl = await uploadFileToStorage('materials', matFile);
      const newMat = await addLearningMaterial({
        class_id: selectedClass.id,
        teacher_id: user!.id,
        title: matTitle.trim(),
        description: matDesc.trim(),
        file_url: fileUrl,
        file_type: matType
      });

      setMaterials([newMat, ...materials]);
      setMatTitle('');
      setMatDesc('');
      setMatFile(null);
      alert('Upload học liệu thành công!');
    } catch (err: any) {
      alert('Lỗi upload học liệu: ' + err.message);
    } finally {
      setMatUploading(false);
    }
  };

  // TẠO TRÒ CHƠI
  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !gameTitle.trim() || !gameUrl.trim()) return;

    try {
      const g = await addGame({
        class_id: selectedClass.id,
        teacher_id: user!.id,
        title: gameTitle.trim(),
        description: gameDesc.trim(),
        game_url: gameUrl.trim()
      });

      setGames([g, ...games]);
      setGameTitle('');
      setGameDesc('');
      setGameUrl('');
      alert('Tạo trò chơi thành công!');
    } catch (err: any) {
      alert('Lỗi tạo trò chơi: ' + err.message);
    }
  };

  // AI GỢI Ý ĐỀ THI TOÁN LỚP 2
  const handleGenerateAiQuestions = async () => {
    setAiLoading(true);
    try {
      const qList = await suggestGrade2Questions(aiTopic, aiQuestionCount);
      setDraftQuestions(qList);
    } catch (err: any) {
      alert('Lỗi AI tạo câu hỏi: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // UPLOAD ẢNH CÂU HỎI TRẮC NGHIỆM
  const handleQuestionImageUpload = async (index: number, file: File) => {
    try {
      const imageUrl = await uploadFileToStorage('question-images', file);
      const updated = [...draftQuestions];
      updated[index].image_url = imageUrl;
      setDraftQuestions(updated);
    } catch (err: any) {
      alert('Lỗi upload ảnh câu hỏi: ' + err.message);
    }
  };

  // CHỐT TẠO BÀI TẬP VÀ GIAO CHO LỚP
  const handleSaveAssignment = async () => {
    if (!selectedClass || !assignTitle.trim() || draftQuestions.length === 0) return;

    try {
      const questionsToSave = draftQuestions.map(q => ({
        question_text: q.question_text,
        image_url: q.image_url,
        options: q.options,
        correct_answers: q.correct_answers,
        points: 10,
        order_index: 0
      }));

      const created = await createAssignmentWithQuestions(
        {
          class_id: selectedClass.id,
          teacher_id: user!.id,
          title: assignTitle.trim(),
          type: assignType,
          is_finalized: true
        },
        questionsToSave
      );

      setAssignments([created, ...assignments]);
      setAssignTitle('');
      setDraftQuestions([]);
      alert('Tạo và giao bài tập cho lớp thành công!');
    } catch (err: any) {
      alert('Lỗi tạo bài tập: ' + err.message);
    }
  };

  // AI PHÂN TÍCH LỖI SAI REAL-TIME CỦA HỌC SINH TRONG LỚP
  const handleAnalyzeClassWeaknesses = async () => {
    if (!selectedClass) return;
    setAiAnalyzing(true);
    try {
      const result = await analyzeStudentWeaknesses([]);
      setAiAnalysisResult(result.summary_notes);
    } catch (err: any) {
      alert('Lỗi phân tích bài làm: ' + err.message);
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* KHU VỰC CHỌN LỚP HỌC & TẠO LỚP MỚI */}
      <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-3 bg-amber-500 text-white rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <label className="text-[11px] font-black text-amber-900 uppercase tracking-wider block">LỚP HỌC ĐANG CHỌN:</label>
            <select
              value={selectedClass?.id || ''}
              onChange={(e) => {
                const cls = classes.find(c => c.id === e.target.value);
                if (cls) setSelectedClass(cls);
              }}
              className="bg-amber-50 border-2 border-amber-300 font-extrabold text-amber-950 px-3 py-1.5 rounded-2xl text-sm focus:outline-none focus:border-amber-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} (Mã Lớp: {c.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowClassModal(true)}
            className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl shadow transition-all"
            title="Tạo lớp học mới"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* NÚT EXPORT & IMPORT EXCEL BÁCH PHÁT BÁCH TRÚNG */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-2xl shadow text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" /> Xuất File Excel Lớp
          </button>

          <label className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2.5 rounded-2xl shadow text-xs flex items-center gap-1.5 cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            {excelLoading ? 'Đang đọc Excel...' : 'Tải lên File Excel Học Sinh'}
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImportExcel}
              disabled={excelLoading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* DANH MỤC TAB TÍNH NĂNG */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'tasks', label: '📋 Nhiệm Vụ Hằng Ngày' },
          { id: 'assignments', label: '📝 Bài Tập & Kiểm Tra' },
          { id: 'materials', label: '📖 Upload Học Liệu' },
          { id: 'games', label: '🎮 Tạo Trò Chơi' },
          { id: 'ai', label: '🧠 AI Hỗ Trợ Giáo Viên' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-2.5 rounded-2xl font-black text-xs transition-all ${
              activeTab === tab.id
                ? 'bg-amber-500 text-white shadow-md scale-105'
                : 'bg-white text-slate-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. NHIỆM VỤ HÀNG NGÀY (THÔNG BÁO TIẾN ĐỘ THỰC TẾ) */}
      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-base font-black text-slate-800">GIAO NHIỆM VỤ HÔM NAY CHO LỚP</h3>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Tên Nhiệm Vụ Cần Giao:</label>
                <input
                  type="text"
                  placeholder="Gõ tên nhiệm vụ (VD: Ôn phép cộng / Làm Bài tập 1...)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* NÚT GỢI Ý MẪU NỘI DUNG NHIỆM VỤ 1-CLICK */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-black text-amber-900 block">💡 Gợi ý tên nhiệm vụ 1-click:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Ôn tập phép cộng có nhớ phạm vi 100',
                    'Làm bài tập trắc nghiệm Tuần 1',
                    'Tham gia trò chơi toán học tương tác',
                    'Xem slide bài giảng phép trừ'
                  ].map((sample, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNewTaskTitle(sample)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-[10px] font-bold transition-all text-left"
                    >
                      + {sample}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3 rounded-2xl shadow text-xs flex items-center justify-center gap-1 mt-2"
              >
                <Plus className="w-4 h-4" /> Giao Nhiệm Vụ Cho Lớp
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-base font-black text-slate-800">DANH SÁCH NHIỆM VỤ ĐÃ GIAO ({tasks.length})</h3>
            <div className="space-y-3">
              {tasks.map(t => (
                <div key={t.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{t.title}</h4>
                    <p className="text-[11px] font-bold text-amber-800">Ngày tạo: {t.due_date}</p>
                  </div>
                  
                  {/* BÁO CÁO TIẾN ĐỘ THỰC TẾ HỌC SINH */}
                  <div className="bg-amber-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black shadow flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-amber-200" />
                    Đã hoàn thành: {t.completed_count} / {t.total_students || students.length} học sinh
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. BÀI TẬP VÀ ĐỀ KIỂM TRA (AI TẠO ĐỀ & CHẤM ĐỀ XUẤT) */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-base font-black text-slate-800">AI SOẠN THẢO ĐỀ KIỂM TRA / BÀI TẬP TOÁN LỚP 2</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateAiQuestions}
                  disabled={aiLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2 rounded-2xl shadow text-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  {aiLoading ? 'AI đang soạn câu hỏi...' : 'AI Tự Động Soạn Đề'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Tên Bài tập / Đề kiểm tra:</label>
                <input
                  type="text"
                  placeholder="VD: Kiểm Tra Ôn Tập Phép Cộng Lớp 2"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Chủ đề bài toán Lớp 2:</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Loại đề bài:</label>
                <select
                  value={assignType}
                  onChange={(e: any) => setAssignType(e.target.value)}
                  className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
                >
                  <option value="exercise">Bài tập Ôn Luyện</option>
                  <option value="weekly_test">Đề Kiểm Tra Tuần</option>
                </select>
              </div>
            </div>

            {/* DANH SÁCH CÂU HỎI AI ĐÃ SOẠN + NÚT THÊM ẢNH */}
            {draftQuestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="font-black text-xs text-purple-900 uppercase">Danh Sách Câu Hỏi Đã Soạn ({draftQuestions.length}):</h4>
                {draftQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-purple-950">Câu {idx + 1}: {q.question_text}</span>
                      <label className="bg-purple-200 hover:bg-purple-300 text-purple-900 font-extrabold px-3 py-1 rounded-xl text-[10px] cursor-pointer flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Thêm ảnh minh họa
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files && handleQuestionImageUpload(idx, e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {q.image_url && (
                      <img src={q.image_url} alt="Question" className="h-24 rounded-lg border border-purple-300 object-contain" />
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                      {q.options.map(opt => (
                        <div key={opt.id} className={`p-2 rounded-xl border ${q.correct_answers.includes(opt.id) ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-black' : 'bg-white border-purple-200 text-slate-700'}`}>
                          {opt.text} {q.correct_answers.includes(opt.id) && '✓ (Đúng)'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleSaveAssignment}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3 rounded-2xl shadow-md text-xs uppercase tracking-wider"
                >
                  Chốt & Giao Đề Bài Cho Lớp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. UPLOAD HỌC LIỆU */}
      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-3">
            <h3 className="text-base font-black text-slate-800">UPLOAD HỌC LIỆU MỚI</h3>
            <form onSubmit={handleUploadMaterial} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Tên Học Liệu (VD: Bài giảng Phép Cộng Lớp 2)"
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
              />

              <textarea
                placeholder="Mô tả học liệu..."
                value={matDesc}
                onChange={(e) => setMatDesc(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold h-20"
              />

              <select
                value={matType}
                onChange={(e: any) => setMatType(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
              >
                <option value="ppt">Slide PowerPoint (.ppt, .pptx)</option>
                <option value="word">File Word (.doc, .docx)</option>
                <option value="video">Video Bài Giảng (.mp4)</option>
                <option value="image">Hình ảnh Toán học</option>
              </select>

              <input
                type="file"
                required
                onChange={(e) => e.target.files && setMatFile(e.target.files[0])}
                className="w-full text-xs font-bold"
              />

              <button
                type="submit"
                disabled={matUploading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 rounded-2xl shadow text-xs flex items-center justify-center gap-1"
              >
                <Upload className="w-4 h-4" /> {matUploading ? 'Đang Upload...' : 'Đăng Học Liệu'}
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-base font-black text-slate-800">DANH SÁCH HỌC LIỆU TRONG LỚP ({materials.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {materials.map(m => (
                <div key={m.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2">
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded-md uppercase">{m.file_type}</span>
                  <h4 className="font-extrabold text-sm text-slate-900">{m.title}</h4>
                  <a href={m.file_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-amber-700 underline block">Mở xem tệp</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. TẠO TRÒ CHƠI (WORDWALL / EMBED / GAME) */}
      {activeTab === 'games' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-3">
            <h3 className="text-base font-black text-slate-800">TẠO TRÒ CHƠI TOÁN HỌC</h3>
            <form onSubmit={handleAddGame} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Tên Trò Chơi (VD: Vòng Quay Phép Cộng)"
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
              />

              <textarea
                placeholder="Hướng dẫn trò chơi..."
                value={gameDesc}
                onChange={(e) => setGameDesc(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold h-20"
              />

              <input
                type="url"
                required
                placeholder="Đường link Trò chơi (Wordwall, Quizizz, iFrame URL)"
                value={gameUrl}
                onChange={(e) => setGameUrl(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
              />

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 rounded-2xl shadow text-xs flex items-center justify-center gap-1"
              >
                <Gamepad2 className="w-4 h-4" /> Đăng Trò Chơi
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-base font-black text-slate-800">DANH SÁCH TRÒ CHƠI CỦA LỚP ({games.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {games.map(g => (
                <div key={g.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2">
                  <h4 className="font-extrabold text-sm text-slate-900">{g.title}</h4>
                  <a href={g.game_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-amber-700 underline block">Thử chơi trò chơi</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. AI HỖ TRỢ GIÁO VIÊN & PHÂN TÍCH LỖI SAI REAL-TIME */}
      {activeTab === 'ai' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-600" />
                AI PHÂN TÍCH LỖI SAI & TỔNG HỢP KIẾN THỨC YẾU CỦA LỚP
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                Hệ thống tự động thống kê bài làm sai thực tế của học sinh để gợi ý kiến thức cần ôn tập lại.
              </p>
            </div>

            <button
              onClick={handleAnalyzeClassWeaknesses}
              disabled={aiAnalyzing}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-5 py-2.5 rounded-2xl shadow text-xs flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-4 h-4 text-yellow-300 ${aiAnalyzing ? 'animate-spin' : ''}`} />
              {aiAnalyzing ? 'AI Đang Phân Tích...' : 'Phân Tích Ngay'}
            </button>
          </div>

          {aiAnalysisResult ? (
            <div className="p-5 rounded-2xl bg-purple-50 border-2 border-purple-200 space-y-3">
              <h4 className="font-black text-sm text-purple-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" /> BÁO CÁO PHÂN TÍCH AI:
              </h4>
              <div className="text-xs font-bold text-purple-900 whitespace-pre-line leading-relaxed">
                {aiAnalysisResult}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
              Nhấp vào nút "Phân Tích Ngay" để AI tổng hợp các dạng bài toán lớp đang làm sai nhiều nhất nhé!
            </div>
          )}
        </div>
      )}

      {/* MODAL TẠO LỚP HỌC MỚI */}
      {showClassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-amber-200 p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-800">TẠO LỚP HỌC MỚI (KHỐI LỚP 2)</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tên Lớp Học:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Lớp Hai 4 / Lớp 2A1"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 rounded-2xl text-xs shadow"
                >
                  Xác Nhận Tạo Lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
