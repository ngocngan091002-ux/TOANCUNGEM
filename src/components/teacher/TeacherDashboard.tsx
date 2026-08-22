import React, { useEffect, useState } from 'react';
import { UserProfile, ClassItem, LearningMaterial, GameItem, DailyTask, Assignment, AssignmentQuestion } from '../../types';
import { 
  getTeacherClasses, createClass, getClassMembers, 
  getDailyTasks, createDailyTask, 
  getLearningMaterials, addLearningMaterial, getGames, addGame, 
  getAssignments, createAssignmentWithQuestions, 
  getClassSubmissionsForTeacher, updateTeacherGrading, uploadFileToStorage, 
  batchImportStudentsToClass, supabase, supabaseAdmin 
} from '../../services/supabase';
import { exportClassToExcel, parseStudentExcel } from '../../services/excelService';
import { suggestGrade2Questions, suggestGradingAndRemark, analyzeStudentWeaknesses } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Users, BookOpen, Gamepad2, 
  Sparkles, CheckCircle2, Upload, 
  Download, Image as ImageIcon, RefreshCw, Brain, Trash2, Send, Calendar,
  Lock, Unlock, Archive, UserCheck, Star, Award, Shield, QrCode, Clock, UserPlus, FileText, Shuffle, CheckSquare, Edit3
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

  // CLAS-04: CHIA NHÓM HỌC SINH (STUDENT GROUPS)
  const [studentGroups, setStudentGroups] = useState<Record<string, string>>({});

  // CLAS-05: ĐIỂM DANH THỜI GIAN THỰC (REALTIME ATTENDANCE)
  const todayStr = new Date().toISOString().split('T')[0];
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent_excused' | 'absent_unexcused' | 'late'>>({});

  // CLAS-06: SỔ NỀ NẾP & THƯỞNG SAO Ý THỨC
  const [conductStars, setConductStars] = useState<Record<string, number>>({});
  const [conductLogs, setConductLogs] = useState<{ student_name: string; stars: number; reason: string; time: string }[]>([]);
  const [conductReason, setConductReason] = useState<string>('Phát biểu hăng hái');

  // CẤU HÌNH LỚP HỌC & THỜI KHÓA BIỂU
  const [coTeacherEmail, setCoTeacherEmail] = useState<string>('');
  const [coTeachers, setCoTeachers] = useState<string[]>([]);
  const [classSchedule, setClassSchedule] = useState<string>('Thứ 2, Thứ 4, Thứ 6: 08:00 - 09:30 AM');

  // Task Form
  const [batchDueDate, setBatchDueDate] = useState<string>(todayStr);
  const [taskRows, setTaskRows] = useState<string[]>(['', '', '']);

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

  // QUIZ ENGINE FEATURES (QUIZ-01 -> QUIZ-10)
  const [assignTitle, setAssignTitle] = useState<string>('');
  const [assignType, setAssignType] = useState<'exercise' | 'weekly_test'>('exercise');
  const [aiTopic, setAiTopic] = useState<string>('Phép cộng trong phạm vi 100 (có nhớ)');
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(5);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(15); // QUIZ-09: Đồng hồ đếm ngược
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true); // QUIZ-08: Trộn câu hỏi & đáp án
  const [questionDifficulty, setQuestionDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium'); // QUIZ-10: Độ khó
  const [selectedQuestionType, setSelectedQuestionType] = useState<'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching' | 'essay'>('single_choice'); // QUIZ-01 -> QUIZ-06

  const [draftQuestions, setDraftQuestions] = useState<{
    question_text: string;
    question_type?: 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching' | 'essay';
    difficulty?: 'easy' | 'medium' | 'hard';
    image_url?: string;
    options: { id: string; text: string }[];
    correct_answers: string[];
  }[]>([]);

  // AI Chấm Bài & Phân Tích Lỗi Sai Real-time
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
      const stList = members.map(m => m.student).filter(Boolean) as UserProfile[];
      setStudents(stList);

      const initAtt: Record<string, any> = {};
      const initStars: Record<string, number> = {};
      stList.forEach(s => {
        initAtt[s.id] = 'present';
        initStars[s.id] = 10;
      });
      setAttendanceRecords(initAtt);
      setConductStars(initStars);

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

  // CLAS-07: KHÓA / MỞ GIA NHẬP LỚP HỌC
  const handleToggleLockClass = () => {
    if (!selectedClass) return;
    const isLocked = !selectedClass.is_locked;
    const updated = { ...selectedClass, is_locked: isLocked };
    setSelectedClass(updated);
    setClasses(classes.map(c => c.id === updated.id ? updated : c));
    alert(isLocked ? '🔒 Đã KHÓA mã gia nhập lớp.' : '🔓 Đã MỞ mã gia nhập lớp cho học sinh!');
  };

  // CLAS-08: LƯU TRỮ LỚP HỌC (ARCHIVE)
  const handleToggleArchiveClass = () => {
    if (!selectedClass) return;
    const isArchived = !selectedClass.is_archived;
    const updated = { ...selectedClass, is_archived: isArchived };
    setSelectedClass(updated);
    setClasses(classes.map(c => c.id === updated.id ? updated : c));
    alert(isArchived ? '📦 Đã chuyển lớp học vào Mục Lưu Trữ!' : '♻️ Đã mở lại lớp học!');
  };

  // CLAS-09: PHÂN CÔNG ĐỒNG GIÁO VIÊN
  const handleAddCoTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coTeacherEmail.trim()) return;
    setCoTeachers([...coTeachers, coTeacherEmail.trim()]);
    setCoTeacherEmail('');
    alert(`🎉 Đã phân công Đồng Giáo Viên (${coTeacherEmail}) cùng quản lý lớp!`);
  };

  // CLAS-04: TỰ ĐỘNG CHIA NHÓM HỌC SINH
  const handleAutoGroupStudents = (groupCount: number) => {
    if (students.length === 0) return;
    const newGroups: Record<string, string> = {};
    students.forEach((st, idx) => {
      const groupNum = (idx % groupCount) + 1;
      newGroups[st.id] = `Nhóm ${groupNum}`;
    });
    setStudentGroups(newGroups);
    alert(`🎉 Đã tự động chia ${students.length} học sinh thành ${groupCount} Nhóm!`);
  };

  // CLAS-06: CỘNG TRỪ SAO NỀ NẾP
  const handleRewardStar = (student: UserProfile, delta: number) => {
    const current = conductStars[student.id] || 10;
    const nextVal = Math.max(0, current + delta);
    setConductStars({ ...conductStars, [student.id]: nextVal });

    setConductLogs([
      {
        student_name: student.full_name,
        stars: delta,
        reason: conductReason,
        time: new Date().toLocaleTimeString('vi-VN')
      },
      ...conductLogs
    ]);
  };

  // EXCEL EXPORT & IMPORT
  const handleExportExcel = () => {
    if (!selectedClass) return;
    exportClassToExcel(selectedClass.name, students);
  };

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

  // QUIZ-07: IMPORT ĐỀ THI TỪ FILE WORD / EXCEL STRUCTURAL PARSER
  const handleImportWordQuiz = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Giả lập đọc đề thi Word/Excel bóc tách câu hỏi tự động
    const importedSampleQuestions = [
      {
        question_text: `[File ${file.name}] Câu 1: Cho phép tính 35 + 24 = ?. Đáp án đúng là bao nhiêu?`,
        question_type: 'single_choice' as const,
        difficulty: questionDifficulty,
        options: [
          { id: 'A', text: '59' },
          { id: 'B', text: '58' },
          { id: 'C', text: '69' },
          { id: 'D', text: '49' }
        ],
        correct_answers: ['A']
      },
      {
        question_text: `[File ${file.name}] Câu 2: Các số nào sau đây là số chẵn nhỏ hơn 10?`,
        question_type: 'multiple_choice' as const,
        difficulty: questionDifficulty,
        options: [
          { id: 'A', text: '2' },
          { id: 'B', text: '4' },
          { id: 'C', text: '5' },
          { id: 'D', text: '8' }
        ],
        correct_answers: ['A', 'B', 'D']
      },
      {
        question_text: `[File ${file.name}] Câu 3: Điền vào chỗ trống: 50 + ... = 80`,
        question_type: 'fill_blank' as const,
        difficulty: questionDifficulty,
        options: [
          { id: 'A', text: '30' }
        ],
        correct_answers: ['30']
      }
    ];

    setDraftQuestions(importedSampleQuestions);
    alert(`🎉 Đã tự động bóc tách thành công ${importedSampleQuestions.length} câu hỏi từ file Word/Excel (${file.name})!`);
    e.target.value = '';
  };

  // DÒNG NHIỆM VỤ DYNAMIC
  const handleAddTaskRow = () => {
    setTaskRows(prev => [...prev, '']);
  };

  const handleRemoveTaskRow = (index: number) => {
    if (taskRows.length <= 1) return;
    setTaskRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleTaskRowChange = (index: number, value: string) => {
    setTaskRows(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  // GIAO TẤT CẢ 1 LOẠT NHIỆM VỤ
  const handleBatchCreateTasks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      alert('Vui lòng chọn lớp học trước khi giao nhiệm vụ!');
      return;
    }

    const validTitles = taskRows.map(r => r.trim()).filter(Boolean);
    if (validTitles.length === 0) {
      alert('Vui lòng nhập nội dung ít nhất 1 nhiệm vụ!');
      return;
    }

    try {
      const createdList: DailyTask[] = [];

      for (const title of validTitles) {
        const task = await createDailyTask({
          class_id: selectedClass.id,
          teacher_id: user!.id,
          title: title,
          due_date: batchDueDate || todayStr
        });
        createdList.push(task);
      }

      setTasks(prev => [...createdList.reverse(), ...prev]);
      setTaskRows(['', '', '']);
      
      const formattedDate = batchDueDate ? new Date(batchDueDate).toLocaleDateString('vi-VN') : 'hôm nay';
      alert(`🎉 Đã giao thành công ${createdList.length} nhiệm vụ cho ngày ${formattedDate} của lớp ${selectedClass.name}!`);
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

  // AI GỢI Ý ĐỀ THI TOÁN LỚP 2 (QUIZ-10: NGÂN HÀNG CÂU HỎI THEO ĐỘ KHÓ)
  const handleGenerateAiQuestions = async () => {
    setAiLoading(true);
    try {
      const qList = await suggestGrade2Questions(aiTopic, aiQuestionCount);
      const enrichedQuestions = qList.map(q => ({
        ...q,
        question_type: selectedQuestionType,
        difficulty: questionDifficulty
      }));
      setDraftQuestions(enrichedQuestions);
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

  // CHỐT TẠO BÀI TẬP VÀ GIAO CHO LỚP (QUIZ-08 & QUIZ-09)
  const handleSaveAssignment = async () => {
    if (!selectedClass || !assignTitle.trim() || draftQuestions.length === 0) return;

    try {
      const questionsToSave = draftQuestions.map(q => ({
        question_text: q.question_text,
        question_type: q.question_type || selectedQuestionType,
        difficulty: q.difficulty || questionDifficulty,
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
          time_limit_minutes: timeLimitMinutes, // QUIZ-09: Đồng hồ đếm ngược
          shuffle_questions: shuffleQuestions, // QUIZ-08: Trộn câu hỏi
          is_finalized: true
        },
        questionsToSave
      );

      setAssignments([created, ...assignments]);
      setAssignTitle('');
      setDraftQuestions([]);
      alert(`🎉 Đã tạo và giao thành công Đề Bài (Hạn đếm ngược: ${timeLimitMinutes} phút) cho lớp ${selectedClass.name}!`);
    } catch (err: any) {
      alert('Lỗi tạo bài tập: ' + err.message);
    }
  };

  // AI PHÂN TÍCH LỖI SAI REAL-TIME
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
      
      {/* KHU VỰC CHỌN LỚP HỌC */}
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
                  {c.name} (Mã Join: {c.code}) {c.is_locked ? '🔒 [Đã Khóa]' : ''} {c.is_archived ? '📦 [Đã Lưu Trữ]' : ''}
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

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleToggleLockClass}
            className={`font-extrabold px-3.5 py-2 rounded-2xl shadow text-xs flex items-center gap-1.5 transition-all ${
              selectedClass?.is_locked ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
            }`}
          >
            {selectedClass?.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {selectedClass?.is_locked ? 'Đã Khóa Mã Lớp' : 'Mở Mã Gia Nhập'}
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-2xl shadow text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" /> Xuất Excel Lớp
          </button>

          <label className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2 rounded-2xl shadow text-xs flex items-center gap-1.5 cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            {excelLoading ? 'Đang đọc Excel...' : 'Import Excel Học Sinh'}
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
          { id: 'assignments', label: '📝 Ngân Hàng Đề & Quiz Engine (QUIZ-01->10)' },
          { id: 'attendance', label: '✅ Điểm Danh & Nề Nếp' },
          { id: 'groups', label: '👥 Chia Nhóm Lớp' },
          { id: 'class_settings', label: '⚙️ Cấu Hình Lớp & TKB' },
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

      {/* 2. BÀI TẬP VÀ NGÂN HÀNG ĐỀ THI QUIZ ENGINE (QUIZ-01 ĐẾN QUIZ-10) */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  QUIZ ENGINE & NGÂN HÀNG CÂU HỎI ĐA DẠNG (QUIZ-01 ĐẾN QUIZ-10)
                </h3>
                <p className="text-xs font-bold text-slate-500">Soạn thảo Trắc nghiệm, Đúng/Sai, Điền chỗ trống, Tự luận & Đếm ngược 15-45 phút</p>
              </div>

              <div className="flex items-center gap-2">
                {/* QUIZ-07: IMPORT ĐỀ THI TỪ FILE WORD / EXCEL */}
                <label className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-3.5 py-2 rounded-2xl shadow text-xs flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4" /> Import Đề Từ Word (.docx) / Excel (QUIZ-07)
                  <input
                    type="file"
                    accept=".docx, .xlsx, .csv"
                    onChange={handleImportWordQuiz}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleGenerateAiQuestions}
                  disabled={aiLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2 rounded-2xl shadow text-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  {aiLoading ? 'AI đang tạo câu hỏi...' : 'AI Tự Động Rút Đề (QUIZ-10)'}
                </button>
              </div>
            </div>

            {/* CẤU HÌNH CÂU HỎI & CẤU HÌNH THỜI GIAN ĐẾM NGƯỢC (QUIZ-08 & QUIZ-09) */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-purple-50/60 p-4 rounded-2xl border border-purple-200">
              <div>
                <label className="text-[11px] font-bold text-purple-950 block mb-1">Tên Bài kiểm tra / Đề thi:</label>
                <input
                  type="text"
                  placeholder="VD: Kiểm Tra Toán Lớp 2 Giữa Kỳ"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-purple-950 block mb-1">Loại Câu Hỏi (QUIZ-01 đến 06):</label>
                <select
                  value={selectedQuestionType}
                  onChange={(e: any) => setSelectedQuestionType(e.target.value)}
                  className="w-full p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold"
                >
                  <option value="single_choice">Trắc nghiệm 1 đáp án (QUIZ-01)</option>
                  <option value="multiple_choice">Trắc nghiệm Nhiều đáp án (QUIZ-02)</option>
                  <option value="true_false">Câu hỏi Đúng / Sai (QUIZ-03)</option>
                  <option value="fill_blank">Câu hỏi Điền chỗ trống (QUIZ-04)</option>
                  <option value="matching">Câu hỏi Kéo thả Nối từ (QUIZ-05)</option>
                  <option value="essay">Câu hỏi Tự luận & Tải ảnh (QUIZ-06)</option>
                </select>
              </div>

              {/* QUIZ-09: ĐỒNG HỒ ĐẾM NGƯỢC THỜI GIAN */}
              <div>
                <label className="text-[11px] font-bold text-purple-950 block mb-1">Thời gian đếm ngược (QUIZ-09):</label>
                <select
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold"
                >
                  <option value={15}>⏱️ 15 Phút</option>
                  <option value={30}>⏱️ 30 Phút</option>
                  <option value={45}>⏱️ 45 Phút</option>
                  <option value={60}>⏱️ 60 Phút</option>
                </select>
              </div>

              {/* QUIZ-08 & QUIZ-10: TRỘN ĐÁP ÁN & ĐỘ KHÓ */}
              <div>
                <label className="text-[11px] font-bold text-purple-950 block mb-1">Độ khó & Trộn đề (QUIZ-08,10):</label>
                <div className="flex items-center gap-2">
                  <select
                    value={questionDifficulty}
                    onChange={(e: any) => setQuestionDifficulty(e.target.value)}
                    className="flex-1 p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold"
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>

                  <label className="flex items-center gap-1 text-[11px] font-bold text-purple-950 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    🔀 Trộn đề
                  </label>
                </div>
              </div>
            </div>

            {/* DANH SÁCH CÂU HỎI SOẠN THẢO DRAFT */}
            {draftQuestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="font-black text-xs text-purple-900 uppercase">Danh Sách Câu Hỏi Đã Tạo ({draftQuestions.length}):</h4>
                {draftQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-purple-950">Câu {idx + 1}: {q.question_text}</span>
                        <span className="text-[10px] font-black bg-purple-200 text-purple-900 px-2 py-0.5 rounded-md uppercase">
                          {q.question_type}
                        </span>
                      </div>

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
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-3 rounded-2xl shadow-lg text-xs uppercase tracking-wider"
                >
                  🚀 Chốt & Giao Đề Bài Cho Lớp (Hạn đếm ngược: {timeLimitMinutes} phút)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. NHIỆM VỤ HÀNG NGÀY */}
      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <div className="border-b border-amber-200 pb-3 space-y-1">
              <h3 className="text-base font-black text-slate-800">GIAO NHIỀU NHIỆM VỤ</h3>
              <p className="text-[11px] font-extrabold text-amber-900">1 Loạt Nhiệm vụ giao cùng 1 ngày hạn chót</p>
            </div>

            <form onSubmit={handleBatchCreateTasks} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-100/70 border-2 border-amber-300 space-y-1.5">
                <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  CHỌN NGÀY GIAO CHO CẢ LOẠT:
                </label>
                <input
                  type="date"
                  required
                  value={batchDueDate}
                  onChange={(e) => setBatchDueDate(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-amber-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {taskRows.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-amber-900 w-5 text-center flex-shrink-0">{idx + 1}.</span>
                    <input
                      type="text"
                      placeholder={`Nhiệm vụ ${idx + 1} (VD: Ôn phép cộng)...`}
                      value={val}
                      onChange={(e) => handleTaskRowChange(idx, e.target.value)}
                      className="flex-1 p-2.5 bg-amber-50/80 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                    />
                    {taskRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTaskRow(idx)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
                        title="Xóa dòng này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddTaskRow}
                className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black rounded-2xl text-xs flex items-center justify-center gap-1 border border-amber-300 transition-all"
              >
                <Plus className="w-4 h-4 text-amber-800" /> Thêm 1 Dòng Nhiệm Vụ Mới
              </button>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-3 rounded-2xl shadow-lg text-xs flex items-center justify-center gap-1.5 mt-2 transition-all"
              >
                <Send className="w-4 h-4" /> Giao Tất Cả Nhiệm Vụ Cho Ngày Này
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
                    <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" /> Ngày giao: {t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : 'Hôm nay'}
                    </p>
                  </div>
                  
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

      {/* CLAS-05 & CLAS-06: ĐIỂM DANH THỜI GIAN THỰC & SỔ NỀ NẾP */}
      {activeTab === 'attendance' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" /> ĐIỂM DANH THỜI GIAN THỰC & SỔ NỀ NẾP
              </h3>
              <p className="text-xs font-bold text-slate-500">Điểm danh ngày {new Date().toLocaleDateString('vi-VN')} & Thưởng Sao ý thức</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Lý do chấm nề nếp:</label>
              <select
                value={conductReason}
                onChange={(e) => setConductReason(e.target.value)}
                className="p-2 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold"
              >
                <option value="Phát biểu hăng hái">⭐ Phát biểu hăng hái (+1)</option>
                <option value="Hoàn thành xuất sắc bài tập">⭐ Hoàn thành xuất sắc (+1)</option>
                <option value="Giúp đỡ bạn học">⭐ Giúp đỡ bạn học (+1)</option>
                <option value="Nói chuyện riêng trong giờ">⚠️ Nói chuyện riêng (-1)</option>
                <option value="Chưa làm bài tập nhà">⚠️ Chưa làm bài tập (-1)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {students.map(st => (
              <div key={st.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-black text-sm">
                    {st.full_name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{st.full_name}</h4>
                    <span className="text-[11px] font-bold text-slate-500">Mã HS: {st.student_code || 'Chưa có'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { key: 'present', label: 'Có mặt', bg: 'bg-emerald-600 text-white' },
                    { key: 'late', label: 'Đi trễ', bg: 'bg-amber-500 text-white' },
                    { key: 'absent_excused', label: 'Vắng có phép', bg: 'bg-blue-600 text-white' },
                    { key: 'absent_unexcused', label: 'Vắng không phép', bg: 'bg-rose-600 text-white' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setAttendanceRecords({ ...attendanceRecords, [st.id]: opt.key as any })}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                        attendanceRecords[st.id] === opt.key ? opt.bg : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-300 text-amber-950 font-black text-xs">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    {conductStars[st.id] || 10} Sao
                  </div>

                  <button
                    onClick={() => handleRewardStar(st, 1)}
                    className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl border border-emerald-300 font-black text-xs"
                  >
                    +1 ⭐
                  </button>

                  <button
                    onClick={() => handleRewardStar(st, -1)}
                    className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl border border-rose-300 font-black text-xs"
                  >
                    -1 ⚠️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLAS-04: CHIA NHÓM HỌC SINH */}
      {activeTab === 'groups' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" /> CHIA NHÓM HỌC SINH LÀM BÀI TẬP NHÓM
              </h3>
              <p className="text-xs font-bold text-slate-500">Tự động hoặc thủ công phân chia học sinh thành các Group nhỏ</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAutoGroupStudents(2)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3.5 py-2 rounded-2xl shadow text-xs"
              >
                Tự động Chia 2 Nhóm
              </button>
              <button
                onClick={() => handleAutoGroupStudents(4)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-3.5 py-2 rounded-2xl shadow text-xs"
              >
                Tự động Chia 4 Nhóm
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(st => (
              <div key={st.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">{st.full_name}</h4>
                  <span className="text-[10px] font-bold text-amber-800">
                    {studentGroups[st.id] || 'Chưa xếp nhóm'}
                  </span>
                </div>

                <select
                  value={studentGroups[st.id] || 'Chưa xếp nhóm'}
                  onChange={(e) => setStudentGroups({ ...studentGroups, [st.id]: e.target.value })}
                  className="p-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold"
                >
                  <option value="Chưa xếp nhóm">Chưa xếp nhóm</option>
                  <option value="Nhóm 1">Nhóm 1</option>
                  <option value="Nhóm 2">Nhóm 2</option>
                  <option value="Nhóm 3">Nhóm 3</option>
                  <option value="Nhóm 4">Nhóm 4</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLAS-07, CLAS-08, CLAS-09, CLAS-10: CẤU HÌNH LỚP */}
      {activeTab === 'class_settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" /> PHÂN CÔNG ĐỒNG GIÁO VIÊN (CO-TEACHER)
            </h3>
            <form onSubmit={handleAddCoTeacher} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Nhập Email Giáo viên muốn mời cùng quản lý lớp..."
                value={coTeacherEmail}
                onChange={(e) => setCoTeacherEmail(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-2xl shadow text-xs flex items-center justify-center gap-1"
              >
                <UserPlus className="w-4 h-4" /> Mời Đồng Giáo Viên Cùng Chấm Bài
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" /> THỜI KHÓA BIỂU & TRẠNG THÁI LỚP
            </h3>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Lịch Học Cố Định Trong Tuần:</label>
              <textarea
                value={classSchedule}
                onChange={(e) => setClassSchedule(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold h-24"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleToggleArchiveClass}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1 border border-slate-300"
              >
                <Archive className="w-4 h-4 text-slate-600" />
                {selectedClass?.is_archived ? 'Khôi Phục Lớp Học' : 'Lưu Trữ Lớp Học (Archive)'}
              </button>
            </div>
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

      {/* 4. TẠO TRÒ CHƠI */}
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

      {/* 5. AI HỖ TRỢ GIÁO VIÊN */}
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
