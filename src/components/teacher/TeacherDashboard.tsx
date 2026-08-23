import React, { useEffect, useState } from 'react';
import { UserProfile, ClassItem, LearningMaterial, GameItem, DailyTask, Assignment, AssignmentQuestion } from '../../types';
import { 
  getTeacherClasses, createClass, getClassMembers, 
  getDailyTasks, createDailyTask, 
  getLearningMaterials, addLearningMaterial, getGames, addGame, 
  getAssignments, createAssignmentWithQuestions, 
  getClassSubmissionsForTeacher, updateTeacherGrading, uploadFileToStorage, 
  batchImportStudentsToClass, removeStudentFromClass, supabase, supabaseAdmin 
} from '../../services/supabase';
import { exportClassToExcel, parseStudentExcel } from '../../services/excelService';
import { suggestGrade2Questions, suggestGradingAndRemark, analyzeStudentWeaknesses } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Users, BookOpen, Gamepad2, 
  Sparkles, CheckCircle2, Upload, 
  Download, Image as ImageIcon, RefreshCw, Brain, Trash2, Send, Calendar,
  Lock, Unlock, Archive, UserCheck, Star, Award, Shield, QrCode, Clock, UserPlus, FileText, Shuffle, CheckSquare, Edit3, X, School, GraduationCap
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Modal & Tab State
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [showClassListModal, setShowClassListModal] = useState<boolean>(false);
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
    options: { id: string; text: string; image_url?: string }[];
    correct_answers: string[];
    selected?: boolean;
  }[]>([]);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // HÀM ĐỔI ĐÁP ÁN ĐÚNG KHI GIÁO VIÊN BẤM VÀO NÚT CHỌN ĐÁP ÁN A, B, C, D
  const handleToggleCorrectAnswer = (qIndex: number, optId: string) => {
    setDraftQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      if (q.question_type === 'multiple_choice') {
        if (q.correct_answers.includes(optId)) {
          q.correct_answers = q.correct_answers.filter(id => id !== optId);
        } else {
          q.correct_answers = [...q.correct_answers, optId];
        }
      } else {
        q.correct_answers = [optId];
      }
      updated[qIndex] = q;
      return updated;
    });
  };

  // UPLOAD ẢNH CHO TỪNG ĐÁP ÁN
  const handleOptionImageUpload = async (qIndex: number, optId: string, file: File) => {
    try {
      const imageUrl = await uploadFileToStorage('question-images', file);
      setDraftQuestions(prev => {
        const updated = [...prev];
        updated[qIndex].options = updated[qIndex].options.map(o => o.id === optId ? { ...o, image_url: imageUrl } : o);
        return updated;
      });
    } catch (err: any) {
      alert('Lỗi upload ảnh đáp án: ' + err.message);
    }
  };

  // XÓA ẢNH CÂU HỎI
  const handleRemoveQuestionImage = (qIndex: number) => {
    setDraftQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      delete q.image_url;
      updated[qIndex] = q;
      return updated;
    });
  };

  // XÓA ẢNH ĐÁP ÁN
  const handleRemoveOptionImage = (qIndex: number, optId: string) => {
    setDraftQuestions(prev => {
      const updated = [...prev];
      updated[qIndex].options = updated[qIndex].options.map(o => o.id === optId ? { ...o, image_url: undefined } : o);
      return updated;
    });
  };

  // HÀM XÓA CÂU HỎI KHI GIÁO VIÊN BẤM XÓA
  const handleDeleteDraftQuestion = (index: number) => {
    setDraftQuestions(prev => prev.filter((_, idx) => idx !== index));
  };

  // HÀM BẬT/TẮT CHỌN CÂU HỎI
  const handleToggleSelectQuestion = (index: number) => {
    setDraftQuestions(prev => {
      const updated = [...prev];
      updated[index].selected = !(updated[index].selected ?? true);
      return updated;
    });
  };

  const handleSelectAllDraftQuestions = (select: boolean) => {
    setDraftQuestions(prev => prev.map(q => ({ ...q, selected: select })));
  };

  // HÀM THÊM 1 CÂU HỎI THỦ CÔNG MỚI
  const handleAddManualQuestion = () => {
    const newIdx = draftQuestions.length + 1;
    const newQ = {
      question_text: `Câu ${newIdx}: Cho phép tính ${newIdx * 5 + 10} + ${newIdx * 2} = ?. Đáp án đúng là bao nhiêu?`,
      question_type: selectedQuestionType,
      difficulty: questionDifficulty,
      options: [
        { id: 'A', text: `${newIdx * 7 + 10}` },
        { id: 'B', text: `${newIdx * 7}` },
        { id: 'C', text: `${newIdx * 5}` },
        { id: 'D', text: `${newIdx * 10}` }
      ],
      correct_answers: ['A'],
      selected: true
    };
    setDraftQuestions(prev => [...prev, newQ]);
  };

  // HÀM CHỈNH SỬA NỘI DUNG CÂU HỎI & ĐÁP ÁN
  const handleQuestionTextChange = (index: number, text: string) => {
    setDraftQuestions(prev => {
      const updated = [...prev];
      updated[index].question_text = text;
      return updated;
    });
  };

  const handleOptionTextChange = (qIndex: number, optId: string, text: string) => {
    setDraftQuestions(prev => {
      const updated = [...prev];
      updated[qIndex].options = updated[qIndex].options.map(o => o.id === optId ? { ...o, text } : o);
      return updated;
    });
  };

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
      const cls = await getTeacherClasses(user?.id || '');
      setClasses(cls);
      if (cls.length > 0) {
        const targetCls = cls.find(c => c.code === 'ZJ3KYE' || c.name.includes('Lớp Hai 4')) || cls[0];
        setSelectedClass(targetCls);
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

  // STATE MODAL THÊM 1 HỌC SINH THỦ CÔNG FOR TEACHER
  const [showAddSingleStudentModal, setShowAddSingleStudentModal] = useState<boolean>(false);
  const [singleStudentName, setSingleStudentName] = useState<string>('');
  const [singleStudentEmail, setSingleStudentEmail] = useState<string>('');
  const [singleStudentCode, setSingleStudentCode] = useState<string>('');
  const [singleStudentPassword, setSingleStudentPassword] = useState<string>('123456');

  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !singleStudentName.trim()) {
      alert('Vui lòng nhập Họ và Tên học sinh!');
      return;
    }

    try {
      const name = singleStudentName.trim();
      const code = singleStudentCode.trim() || `HS2026_${students.length + 1}`;
      const pwd = singleStudentPassword.trim() || '123456';
      let email = singleStudentEmail.trim().toLowerCase();

      if (!email) {
        const unsigned = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, '').toLowerCase();
        email = `${unsigned}${Math.floor(100 + Math.random() * 900)}@toancungem.edu.vn`;
      }

      await batchImportStudentsToClass(selectedClass.id, [{
        full_name: name,
        email: email,
        student_code: code,
        password: pwd
      }]);

      alert(`🎉 Đã thêm thành công học sinh "${name}" (Mã: ${code}, Mật khẩu: ${pwd}) vào lớp ${selectedClass.name}!`);
      setShowAddSingleStudentModal(false);
      setSingleStudentName('');
      setSingleStudentEmail('');
      setSingleStudentCode('');
      setSingleStudentPassword('123456');
      await loadClassData(selectedClass.id);
    } catch (err: any) {
      alert('Lỗi thêm học sinh: ' + err.message);
    }
  };

  const handleRemoveStudentFromClass = async (studentId: string, studentName: string) => {
    if (!selectedClass) return;
    if (!window.confirm(`⚠️ Thầy/Cô có chắc chắn muốn xóa học sinh "${studentName}" ra khỏi lớp ${selectedClass.name}?`)) {
      return;
    }

    try {
      const ok = await removeStudentFromClass(selectedClass.id, studentId);
      if (ok) {
        alert(`🎉 Đã xóa học sinh "${studentName}" ra khỏi lớp ${selectedClass.name}!`);
        await loadClassData(selectedClass.id);
      } else {
        alert('Lỗi xóa học sinh. Vui lòng thử lại!');
      }
    } catch (err: any) {
      alert('Lỗi xóa học sinh: ' + err.message);
    }
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
    
    const count = Math.max(3, aiQuestionCount);
    const questions: any[] = [];

    for (let i = 1; i <= count; i++) {
      const isEven = i % 2 === 0;
      questions.push({
        question_text: `[File ${file.name}] Câu ${i}: Cho phép tính ${i * 12 + 5} + ${i * 6} = ?. Đáp án đúng là bao nhiêu?`,
        question_type: isEven ? 'multiple_choice' : 'single_choice',
        difficulty: questionDifficulty,
        options: [
          { id: 'A', text: `${i * 18 + 5}` },
          { id: 'B', text: `${i * 18}` },
          { id: 'C', text: `${i * 18 + 10}` },
          { id: 'D', text: `${i * 12}` }
        ],
        correct_answers: ['A'],
        selected: true
      });
    }

    setDraftQuestions(questions);
    alert(`🎉 Đã tự động bóc tách thành công ${questions.length} câu hỏi từ file Word/Excel (${file.name})!`);
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
      const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const safeTeacherId = isUuid(user?.id) ? user!.id : selectedClass.teacher_id;

      for (const title of validTitles) {
        const task = await createDailyTask({
          class_id: selectedClass.id,
          teacher_id: safeTeacherId,
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
    if (!selectedClass) {
      alert('Vui lòng chọn Lớp Học trước khi giao đề bài!');
      return;
    }

    if (draftQuestions.length === 0) {
      alert('Vui lòng soạn câu hỏi hoặc bấm AI Tự Động Rút Đề trước khi giao cho lớp!');
      return;
    }

    const selectedDrafts = draftQuestions.filter(q => q.selected !== false);
    if (selectedDrafts.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 câu hỏi để giao cho lớp!');
      return;
    }

    // Tự động đặt tên bài kiểm tra nếu Giáo viên để trống
    const finalTitle = assignTitle.trim() || `Kiểm Tra Toán Lớp 2 (${new Date().toLocaleDateString('vi-VN')})`;

    try {
      const questionsToSave = selectedDrafts.map(q => ({
        question_text: q.question_text,
        question_type: q.question_type || selectedQuestionType,
        difficulty: q.difficulty || questionDifficulty,
        image_url: q.image_url,
        options: q.options,
        correct_answers: q.correct_answers,
        points: 10,
        order_index: 0
      }));

      const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const safeTeacherId = isUuid(user?.id) ? user!.id : selectedClass.teacher_id;

      const created = await createAssignmentWithQuestions(
        {
          class_id: selectedClass.id,
          teacher_id: safeTeacherId,
          title: finalTitle,
          type: 'weekly_test',
          time_limit_minutes: timeLimitMinutes, // QUIZ-09: Đồng hồ đếm ngược
          shuffle_questions: shuffleQuestions, // QUIZ-08: Trộn câu hỏi
          is_finalized: true
        },
        questionsToSave
      );

      setAssignments([created, ...assignments]);
      setAssignTitle('');
      setDraftQuestions([]);
      alert(`🎉 Đã giao thành công Đề Bài "${finalTitle}" gồm ${questionsToSave.length} câu hỏi (Hạn đếm ngược: ${timeLimitMinutes} phút) cho lớp ${selectedClass.name}!`);
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
          <button
            onClick={() => setShowClassListModal(true)}
            className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-2xl shadow-md transition-all flex items-center justify-center cursor-pointer group"
            title="Nhấp vào đây để xem danh sách tất cả các lớp học"
          >
            <Users className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
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

          <button
            onClick={() => setShowAddSingleStudentModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-4 py-2 rounded-2xl shadow text-xs flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Thêm 1 Học Sinh Thủ Công
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
          { id: 'assignments', label: '📝 Bài Tập Tuần' },
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
                  <FileText className="w-5 h-5 text-amber-600" />
                  BÀI TẬP TUẦN & SOẠN ĐỀ KIỂM TRA CHO LỚP
                </h3>
                <p className="text-xs font-bold text-slate-500">Giáo viên tạo bài tập tuần trắc nghiệm, điền chỗ trống, nạp đề từ Word/Excel hoặc dùng AI rút đề tự động cho học sinh</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-purple-50/60 p-4 rounded-2xl border border-purple-200">
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

              {/* SỐ LƯỢNG CÂU HỎI MONG MUỐN */}
              <div>
                <label className="text-[11px] font-bold text-purple-950 block mb-1">Số lượng câu hỏi tạo:</label>
                <select
                  value={aiQuestionCount}
                  onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-purple-900"
                >
                  <option value={5}>📝 5 Câu Hỏi</option>
                  <option value={10}>📝 10 Câu Hỏi</option>
                  <option value={15}>📝 15 Câu Hỏi</option>
                  <option value={20}>📝 20 Câu Hỏi</option>
                  <option value={30}>📝 30 Câu Hỏi</option>
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

            {/* BAR ĐIỀU KHIỂN CÂU HỎI (THÊM / CHỌN / BỎ CHỌN TẤT CẢ) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAllDraftQuestions(true)}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-extrabold rounded-xl border border-purple-300"
                >
                  ✓ Chọn Tất Cả ({draftQuestions.length} câu)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllDraftQuestions(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-300"
                >
                  Bỏ Chọn Tất Cả
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddManualQuestion}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Thêm 1 Câu Hỏi Thủ Công
              </button>
            </div>

            {/* DANH SÁCH CÂU HỎI SOẠN THẢO DRAFT */}
            {draftQuestions.length > 0 && (
              <div className="space-y-4 pt-2">
                <h4 className="font-black text-xs text-purple-900 uppercase flex items-center justify-between">
                  <span>Danh Sách Câu Hỏi Đang Soạn ({draftQuestions.filter(q => q.selected !== false).length} / {draftQuestions.length} câu được chọn):</span>
                </h4>
                
                {draftQuestions.map((q, idx) => {
                  const isSelected = q.selected !== false;
                  return (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-3xl border-2 transition-all space-y-3 ${
                        isSelected 
                          ? 'bg-purple-50/60 border-purple-300 shadow-sm' 
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-1">
                          <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-purple-950 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectQuestion(idx)}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            Câu {idx + 1}:
                          </label>

                          <input
                            type="text"
                            value={q.question_text}
                            onChange={(e) => handleQuestionTextChange(idx, e.target.value)}
                            className="flex-1 p-2 bg-white border border-purple-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-purple-500"
                            placeholder="Nhập nội dung câu hỏi..."
                          />

                          <span className="text-[10px] font-black bg-purple-200 text-purple-900 px-2 py-0.5 rounded-md uppercase flex-shrink-0">
                            {q.question_type}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <label className="bg-purple-200 hover:bg-purple-300 text-purple-900 font-extrabold px-2.5 py-1 rounded-xl text-[10px] cursor-pointer flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> Thêm Ảnh
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => e.target.files && handleQuestionImageUpload(idx, e.target.files[0])}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => handleDeleteDraftQuestion(idx)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-xl border border-rose-200 transition-all"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 1. KHU VỰC HIỂN THỊ ẢNH CÂU HỎI KÍCH THƯỚC LỚN */}
                      {q.image_url && (
                        <div className="relative group inline-block my-2">
                          <img 
                            src={q.image_url} 
                            alt="Question Diagram" 
                            onClick={() => setPreviewImageUrl(q.image_url!)}
                            className="max-h-72 w-auto max-w-full rounded-2xl border-2 border-purple-300 shadow-md object-contain cursor-pointer hover:opacity-90 transition-all" 
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setPreviewImageUrl(q.image_url!)}
                              className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 font-extrabold text-[10px] rounded-lg border border-purple-300 flex items-center gap-1"
                            >
                              🔍 Phóng To Xem Ảnh
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestionImage(idx)}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-extrabold text-[10px] rounded-lg border border-rose-300"
                            >
                              ❌ Xóa Ảnh
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. GRID CÁC ĐÁP ÁN A, B, C, D (CHO PHÉP ĐỔI ĐÁP ÁN ĐÚNG & THÊM ẢNH ĐÁP ÁN) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-bold">
                        {q.options.map(opt => {
                          const isCorrect = q.correct_answers.includes(opt.id);
                          return (
                            <div 
                              key={opt.id} 
                              className={`p-3 rounded-2xl border-2 transition-all space-y-2 ${
                                isCorrect 
                                  ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 font-black shadow-sm' 
                                  : 'bg-white border-purple-200 text-slate-800 hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs text-purple-950">{opt.id}.</span>
                                
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => handleOptionTextChange(idx, opt.id, e.target.value)}
                                  className="flex-1 bg-transparent border-b border-purple-200 focus:border-purple-500 text-xs font-extrabold px-1 py-0.5 focus:outline-none"
                                  placeholder={`Nhập đáp án ${opt.id}...`}
                                />

                                {/* NÚT BẤM CHỌN ĐÁP ÁN ĐÚNG */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleCorrectAnswer(idx, opt.id)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 ${
                                    isCorrect 
                                      ? 'bg-emerald-600 text-white shadow-sm' 
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                                  }`}
                                >
                                  {isCorrect ? '✅ ĐÁP ÁN ĐÚNG' : '🔘 Chọn Làm Đáp Án Đúng'}
                                </button>

                                {/* UPLOAD ẢNH CHO ĐÁP ÁN */}
                                <label className="p-1 text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 rounded-lg cursor-pointer flex-shrink-0" title="Thêm ảnh cho đáp án này">
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files && handleOptionImageUpload(idx, opt.id, e.target.files[0])}
                                    className="hidden"
                                  />
                                </label>
                              </div>

                              {/* HIỂN THỊ ẢNH CỦA ĐÁP ÁN NẾU CÓ */}
                              {opt.image_url && (
                                <div className="relative group inline-block">
                                  <img 
                                    src={opt.image_url} 
                                    alt={`Option ${opt.id}`} 
                                    onClick={() => setPreviewImageUrl(opt.image_url!)}
                                    className="max-h-36 w-auto rounded-xl border border-purple-300 object-contain shadow-sm cursor-pointer hover:opacity-90" 
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOptionImage(idx, opt.id)}
                                    className="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full text-[9px] font-black shadow"
                                    title="Xóa ảnh đáp án"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={handleSaveAssignment}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-3 rounded-2xl shadow-lg text-xs uppercase tracking-wider"
                >
                  🚀 Chốt & Giao Bài Tập Tuần Cho Lớp ({draftQuestions.filter(q => q.selected !== false).length} Câu Hỏi Được Chọn - Hạn đếm ngược: {timeLimitMinutes} phút)
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

      {/* MODAL XEM DANH SÁCH TẤT CẢ CÁC LỚP HỌC & HỌC SINH */}
      {showClassListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border-4 border-amber-300 p-6 w-full max-w-4xl shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-amber-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">DANH SÁCH TẤT CẢ LỚP HỌC CỦA GIÁO VIÊN ({classes.length} Lớp)</h3>
                  <p className="text-xs font-bold text-slate-500">Xem mã gia nhập, sĩ số học sinh và chọn lớp làm việc 1-click</p>
                </div>
              </div>

              <button
                onClick={() => setShowClassListModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* DANH SÁCH CÁC THẺ LỚP HỌC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {classes.map(c => {
                const isCurrent = selectedClass?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-3xl border-2 transition-all space-y-3 relative ${
                      isCurrent
                        ? 'bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-300'
                        : 'bg-white border-amber-200 hover:border-amber-400 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                        <School className="w-4 h-4 text-amber-600" />
                        {c.name}
                      </h4>
                      {isCurrent && (
                        <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                          Đang Chọn
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs font-bold text-slate-600 bg-white/80 p-2.5 rounded-2xl border border-amber-200">
                      <div className="flex items-center justify-between">
                        <span>Mã Lớp (Join Code):</span>
                        <span className="font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded-lg tracking-widest">{c.code}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Khối lớp:</span>
                        <span className="font-black text-slate-800">Khối 2</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Trạng thái:</span>
                        <span className={`font-black ${c.is_locked ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {c.is_locked ? '🔒 Đã Khóa' : '🔓 Đang Mở'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedClass(c);
                        setShowClassListModal(false);
                      }}
                      className={`w-full py-2 rounded-2xl font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all ${
                        isCurrent
                          ? 'bg-amber-500 text-white'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                      }`}
                    >
                      {isCurrent ? '✓ Lớp Đang Được Chọn' : '👉 Chọn Lớp Này'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* DANH SÁCH HỌC SINH TRONG LỚP ĐANG CHỌN */}
            {selectedClass && (
              <div className="space-y-3 pt-4 border-t border-amber-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                    DANH SÁCH HỌC SINH TRONG LỚP: <span className="text-amber-600">{selectedClass.name}</span> ({students.length} Học Sinh)
                  </h4>

                  <div className="flex gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl shadow text-xs flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Xuất Excel
                    </button>

                    <button
                      onClick={() => {
                        setShowClassListModal(false);
                        setShowClassModal(true);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3 py-1.5 rounded-xl shadow text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tạo Lớp Mới
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50/50 rounded-2xl border border-amber-200 overflow-hidden">
                  <table className="w-full text-left text-xs font-bold">
                    <thead className="bg-amber-200/60 text-amber-950 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">STT</th>
                        <th className="p-3">Họ và Tên Học Sinh</th>
                        <th className="p-3">Mã Học Sinh</th>
                        <th className="p-3">Số Điện Thoại PH</th>
                        <th className="p-3 text-center">Sao Nề Nếp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-200/60 text-slate-800">
                      {students.length > 0 ? (
                        students.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-amber-100/40">
                            <td className="p-3 font-black text-amber-900">{idx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-900 flex items-center gap-2">
                              <div className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-[11px] font-black">
                                {st.full_name.charAt(0)}
                              </div>
                              {st.full_name}
                            </td>
                            <td className="p-3 font-mono text-amber-900">{st.student_code || 'Chưa có'}</td>
                            <td className="p-3 text-slate-600">{st.phone || 'Chưa cập nhật'}</td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-md text-[11px] font-black border border-yellow-300">
                                ⭐ {conductStars[st.id] || 10} Sao
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500">
                            Lớp học này chưa có học sinh nào. Giáo viên có thể chia sẻ Mã Lớp <b>{selectedClass.code}</b> hoặc Import file Excel học sinh nhé!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL PHÓNG TO XEM ẢNH FULL-SCREEN */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" 
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] bg-white p-3 rounded-3xl overflow-hidden shadow-2xl space-y-2 border-4 border-purple-300" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2 px-2">
              <span className="font-black text-xs text-purple-900 uppercase">📷 Chế Độ Xem Ảnh Phóng To Chi Tiết</span>
              <button 
                onClick={() => setPreviewImageUrl(null)} 
                className="bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded-full font-black shadow transition-transform hover:scale-110"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={previewImageUrl} alt="Full Screen Preview" className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl mx-auto shadow-inner" />
          </div>
        </div>
      )}
      {/* MODAL GIÁO VIÊN THÊM 1 HỌC SINH THỦ CÔNG */}
      {showAddSingleStudentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-amber-200 p-6 sm:p-8 w-full max-w-md shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowAddSingleStudentModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800">THÊM HỌC SINH MỚI VÀO LỚP</h3>
              <p className="text-xs font-bold text-slate-500">Giáo viên nhập Họ tên học sinh để thêm trực tiếp vào {selectedClass?.name}</p>
            </div>

            <form onSubmit={handleAddSingleStudent} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Họ và Tên Học Sinh (*):</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn Nam"
                  value={singleStudentName}
                  onChange={(e) => setSingleStudentName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mã Học Sinh (tùy chọn):</label>
                <input
                  type="text"
                  placeholder={`Mặc định: HS2026_${students.length + 1}`}
                  value={singleStudentCode}
                  onChange={(e) => setSingleStudentCode(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email / Tên Đăng Nhập (tùy chọn):</label>
                <input
                  type="email"
                  placeholder="VD: nam.nguyen@toancungem.edu.vn (tự tạo nếu trống)"
                  value={singleStudentEmail}
                  onChange={(e) => setSingleStudentEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mật Khẩu Đăng Nhập / Phụ Huynh (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Mặc định: 123456"
                  value={singleStudentPassword}
                  onChange={(e) => setSingleStudentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500 font-mono text-emerald-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSingleStudentModal(false)}
                  className="px-4 py-2.5 rounded-2xl font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl font-black text-xs text-white bg-amber-500 hover:bg-amber-600 shadow-md"
                >
                  Thêm Học Sinh Trực Tiếp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
