import React, { useEffect, useState } from 'react';
import { UserProfile, ClassItem, LearningMaterial, GameItem, DailyTask, Assignment, AssignmentQuestion, AssignmentSubmission, PointLogRecord } from '../../types';
import { 
  getStudentClasses, joinClassByCode, 
  getDailyTasks, markTaskCompleted, 
  getLearningMaterials, getGames, getAssignments, 
  submitAssignment, getStudentSubmissions, getClassLeaderboard, 
  updateUserStatus, supabase, supabaseAdmin, getStudentPointLogs 
} from '../../services/supabase';
import { askAIMathAssistant } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';
import { 
  BookOpen, Gamepad2, Award, CheckCircle2, 
  Clock, Trophy, Sparkles, Send, Play, 
  FileText, Video, Image as ImageIcon, Star, HelpCircle, UserCheck, ShieldCheck, 
  Home, RefreshCw, Flame, Users, Heart, ThumbsUp, X, RotateCcw, Eye
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user, refreshProfile } = useAuth();

  const [studentClasses, setStudentClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classCodeInput, setClassCodeInput] = useState<string>('');
  const [activeMenu, setActiveMenu] = useState<string>('home');

  // Content Lists
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myPointLogs, setMyPointLogs] = useState<PointLogRecord[]>([]);

  // Active Assignment / Quiz Mode
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [questionTimers, setQuestionTimers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedSubmissionDetail, setSelectedSubmissionDetail] = useState<{ assignment: Assignment; submission: any } | null>(null);

  // GAME MODAL & GAMIFICATION (GAME-01 -> GAME-10)
  const [activePlayGame, setActivePlayGame] = useState<GameItem | null>(null);
  const [gamePlayMode, setGamePlayMode] = useState<'official' | 'practice'>('official');
  const [gameTimerSeconds, setGameTimerSeconds] = useState<number>(0);
  const [gameTimerInterval, setGameTimerInterval] = useState<any>(null);
  const [gameLikes, setGameLikes] = useState<Record<string, number>>({});
  const [userLikedGames, setUserLikedGames] = useState<Record<string, boolean>>({});

  // BUILT-IN MINI GAMES (GAME-09)
  const [activeMiniGame, setActiveMiniGame] = useState<'wheel' | 'cards' | null>(null);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState<boolean>(false);

  // AI Math Chat Assistant
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [aiChatMessages, setAiChatMessages] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    { sender: 'ai', text: 'Chào em! Rất vui được đồng hành cùng em học Toán Lớp 2. Em có câu hỏi hay bài toán nào cần anh/chị Trợ lý AI giải đáp không nào? 🌟' }
  ]);
  const [aiChatLoading, setAiChatLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user?.id) {
      loadStudentClasses();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassContent(selectedClassId);
    }
  }, [selectedClassId]);

  const loadStudentClasses = async () => {
    try {
      const cls = await getStudentClasses(user!.id);
      setStudentClasses(cls);
      const targetId = (cls && cls.length > 0) ? cls[0].id : '38546e64-1664-4fed-b1ca-82fbe5e2d194';
      if (!selectedClassId) {
        setSelectedClassId(targetId);
      }
      await loadClassContent(selectedClassId || targetId);
    } catch (err) {
      console.error('Error loading student classes:', err);
    }
  };

  const loadClassContent = async (classId: string) => {
    try {
      // 0. Nạp trước từ LocalStorage để điểm hiển thị tức thì 0 giây
      const localKey = `toan_cung_em_point_logs_${classId}`;
      const savedLogsStr = localStorage.getItem(localKey);
      let localPointLogs: PointLogRecord[] = [];
      if (savedLogsStr) {
        try {
          localPointLogs = JSON.parse(savedLogsStr);
          const studentLocalLogs = localPointLogs.filter((p: any) => p.student_id === user?.id);
          setMyPointLogs(studentLocalLogs);
        } catch (e) {}
      }

      const t = await getDailyTasks(classId, user!.id, user?.email, user?.student_code);
      
      let localCompletedTaskIds: string[] = [];
      if (user?.id) {
        const savedIds = localStorage.getItem(`toan_cung_em_completed_tasks_${user.id}`);
        if (savedIds) {
          try { localCompletedTaskIds = JSON.parse(savedIds); } catch (e) {}
        }
      }

      const mergedTasks = t.map(task => {
        const isDone = task.is_completed || localCompletedTaskIds.includes(task.id);
        return {
          ...task,
          is_completed: isDone
        };
      });

      setTasks(mergedTasks);

      const m = await getLearningMaterials(classId);
      setMaterials(m);

      const g = await getGames(classId);
      setGames(g);

      const a = await getAssignments(classId);
      
      // ⭐ LỌC BÀI TẬP THEO NHÓM HỌC SINH ĐƯỢC PHÂN CÔNG
      const savedGroupsStr = localStorage.getItem(`toan_cung_em_student_groups_${classId}`);
      let studentGroup = 'Chưa xếp nhóm';
      if (savedGroupsStr && user?.id) {
        try {
          const groupMap = JSON.parse(savedGroupsStr);
          studentGroup = groupMap[user.id] || 'Chưa xếp nhóm';
        } catch (e) {}
      }

      const filteredAssignments = a.filter(assign => {
        if (!assign.target_group || assign.target_group === 'all') return true;

        const targetName = assign.target_group === 'group_1' ? 'Nhóm 1' :
                           assign.target_group === 'group_2' ? 'Nhóm 2' :
                           assign.target_group === 'group_3' ? 'Nhóm 3' :
                           assign.target_group === 'group_4' ? 'Nhóm 4' : '';

        if (targetName && studentGroup === targetName) return true;

        if (assign.title && assign.title.includes(`(${studentGroup})`)) return true;

        if (assign.target_group.startsWith('group_') || (assign.title && assign.title.includes('(Nhóm '))) {
          return false;
        }

        return true;
      });

      setAssignments(filteredAssignments);

      const sub = await getStudentSubmissions(user!.id);
      setSubmissions(sub);

      const lb = await getClassLeaderboard(classId);
      setLeaderboard(lb);

      const globalSaved = localStorage.getItem('toan_cung_em_global_point_logs');
      let globalPointLogs: PointLogRecord[] = [];
      if (globalSaved) {
        try { globalPointLogs = JSON.parse(globalSaved); } catch (e) {}
      }

      const pLogs = await getStudentPointLogs(user!.id);
      const mergedMap = new Map<string, PointLogRecord>();
      [...pLogs, ...localPointLogs, ...globalPointLogs].filter((p: any) => p.student_id === user?.id).forEach(item => {
        if (item.id) mergedMap.set(item.id, item);
      });
      const finalLogs = Array.from(mergedMap.values()).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setMyPointLogs(finalLogs);
    } catch (err) {
      console.error('Error loading class content:', err);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCodeInput.trim()) return;

    try {
      const joinedCls = await joinClassByCode(classCodeInput.trim(), user!.id);
      alert(`🎉 Chúc mừng em đã gia nhập thành công vào ${joinedCls.name}!`);
      setClassCodeInput('');
      loadStudentClasses();
      setSelectedClassId(joinedCls.id);
    } catch (err: any) {
      alert(err.message || 'Lỗi gia nhập lớp');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      // 1. Chờ Supabase DB xác nhận lưu thành công trước (Yêu cầu 7 & 14)
      const success = await markTaskCompleted(taskId, user!.id, user?.email, user?.student_code);

      if (!success) {
        alert('⚠️ Chưa thể lưu kết quả vào CSDL. Vui lòng thử lại.');
        return;
      }

      // 2. Sau khi CSDL lưu thành công mới ghi vào LocalStorage & cập nhật giao diện
      if (user?.id) {
        const localKey = `toan_cung_em_completed_tasks_${user.id}`;
        const savedIds = localStorage.getItem(localKey);
        let completedIds: string[] = [];
        if (savedIds) {
          try { completedIds = JSON.parse(savedIds); } catch (e) {}
        }
        if (!completedIds.includes(taskId)) {
          completedIds.push(taskId);
          localStorage.setItem(localKey, JSON.stringify(completedIds));
        }
      }

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: true, completed_count: (t.completed_count || 0) + 1 } : t));
      confetti({ particleCount: 80, spread: 60 });

      alert('🎉 Em đã nộp bài thành công!\n\nBài làm của em đã được gửi đến giáo viên.\n⏳ Đang chờ giáo viên kiểm tra và chốt điểm.');
    } catch (err: any) {
      console.error('handleCompleteTask error:', err);
      alert('⚠️ Chưa thể lưu kết quả. Vui lòng thử lại.');
    }
  };

  // NỘP BÀI TẬP VÀ ĐẾM THỜI GIAN
  const handleStartAssignment = (assign: Assignment) => {
    setActiveAssignment(assign);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setQuestionTimers({});
    setQuestionStartTime(Date.now());
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setQuestionTimers(prev => ({ ...prev, [questionId]: (prev[questionId] || 0) + Math.max(1, elapsed) }));
    setQuestionStartTime(Date.now());

    setUserAnswers(prev => ({
      ...prev,
      [questionId]: [optionId]
    }));
  };

  const handleSubmitAssignment = async () => {
    if (!activeAssignment || !activeAssignment.questions) return;
    setIsSubmitting(true);

    try {
      const responses = activeAssignment.questions.map(q => {
        const chosen = userAnswers[q.id] || [];
        const isCorrect = chosen.length > 0 && q.correct_answers.includes(chosen[0]);
        const timeSpent = questionTimers[q.id] || 5;

        return {
          question_id: q.id,
          selected_options: chosen,
          time_spent_seconds: timeSpent,
          is_correct: isCorrect
        };
      });

      await submitAssignment(activeAssignment.id, user!.id, responses, user?.email, user?.student_code);

      confetti({ particleCount: 100, spread: 80 });
      alert('🎉 Chúc mừng em đã hoàn thành bài tập! Điểm số và thời gian làm bài đã được ghi nhận.');
      
      setActiveAssignment(null);
      if (selectedClassId) loadClassContent(selectedClassId);
    } catch (err: any) {
      alert('Lỗi nộp bài: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // GAME MODAL CONTROLS (GAME-01 -> GAME-10)
  const handleOpenGameModal = (game: GameItem, mode: 'official' | 'practice') => {
    setActivePlayGame(game);
    setGamePlayMode(mode);
    setGameTimerSeconds(0);

    const timer = setInterval(() => {
      setGameTimerSeconds(prev => prev + 1);
    }, 1000);
    setGameTimerInterval(timer);
  };

  const handleCloseGameModal = () => {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (activePlayGame && gamePlayMode === 'official') {
      confetti({ particleCount: 60, spread: 50 });
      alert(`🎉 Đã lưu kết quả chơi Game ${activePlayGame.title} (Thời gian: ${gameTimerSeconds} giây)!`);
    }
    setActivePlayGame(null);
  };

  const handleToggleLikeGame = (gameId: string) => {
    const isLiked = userLikedGames[gameId];
    setUserLikedGames({ ...userLikedGames, [gameId]: !isLiked });
    setGameLikes({ ...gameLikes, [gameId]: (gameLikes[gameId] || 15) + (isLiked ? -1 : 1) });
  };

  // MINI GAME 1: VÒNG QUAY MAY MẮN (GAME-09)
  const handleSpinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    setWheelResult(null);

    setTimeout(() => {
      const items = ['10 Điểm Thưởng ⭐', 'Huy hiệu Dũng Sĩ Toán 🛡️', '20 Điểm Thưởng ⭐', 'Một Tràng Pháo Tay 👏', '15 Điểm Thưởng ⭐'];
      const prize = items[Math.floor(Math.random() * items.length)];
      setWheelResult(prize);
      setSpinning(false);
      confetti({ particleCount: 90, spread: 70 });
    }, 2500);
  };

  // HỎI TRỢ LÝ TOÁN HỌC AI
  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiChatInput.trim() || aiChatLoading) return;

    const userText = aiChatInput.trim();
    setAiChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setAiChatInput('');
    setAiChatLoading(true);

    try {
      const reply = await askAIMathAssistant(userText);
      setAiChatMessages(prev => [...prev, { sender: 'ai', text: reply }]);
    } catch (err: any) {
      setAiChatMessages(prev => [...prev, { sender: 'ai', text: 'Trợ lý AI đang bận một chút, em hỏi lại nhé!' }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const uncompletedCount = assignments.filter(a => !submissions.some(s => s.assignment_id === a.id)).length;

  // ⭐ TÍNH TOÁN ĐIỂM TÍCH LŨY THỰC TẾ (KHÔNG ĐIỂM ẢO)
  const myPointsFromLogs = myPointLogs.reduce((sum, l) => sum + (l.points_change || 0), 0);
  const myTotalPoints = Math.max(0, myPointsFromLogs);
  const myStars = myPointLogs.filter(l => l.type === 'reward').length;

  const myRankInClass = leaderboard.length > 0
    ? (leaderboard.findIndex(item => item.student_id === user?.id || item.email === user?.email) + 1 || 1)
    : 1;

  const studentBadges = [
    { title: 'Ngôi sao đầu tiên', minPoints: 10, icon: '⭐' },
    { title: 'Học sinh chăm chỉ', minPoints: 30, icon: '📚' },
    { title: 'Chiến binh Toán học', minPoints: 50, icon: '⚔️' },
    { title: 'Cao thủ Toán học', minPoints: 100, icon: '🧮' },
    { title: 'Ngôi sao xuất sắc', minPoints: 200, icon: '👑' },
  ];

  const menuItems = [
    { id: 'home', label: '🏠 Trang chủ' },
    { id: 'tasks', label: '📚 Nhiệm vụ hôm nay' },
    { id: 'assignments', label: '📝 Bài Tập Tuần', badge: uncompletedCount },
    { id: 'games', label: '🎮 Kho Trò Chơi' },
    { id: 'materials', label: '📖 Học liệu' },
    { id: 'ai', label: '🤖 Trợ lý AI' },
    { id: 'results', label: '📊 Kết quả & tiến bộ' },
    { id: 'leaderboard', label: '🏆 Bảng xếp hạng' },
    { id: 'profile', label: '👤 Hồ sơ' },
  ];

  const activeClassObj = studentClasses.find(c => c.id === selectedClassId);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* 9 DANH MỤC MENU NAV CHO HỌC SINH */}
      <div className="bg-white p-2 rounded-3xl border-2 border-amber-200 shadow-md flex items-center gap-1.5 overflow-x-auto">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveMenu(item.id); setActiveAssignment(null); }}
            className={`whitespace-nowrap px-3.5 py-2 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 ${
              activeMenu === item.id
                ? 'bg-amber-500 text-white shadow-md scale-105'
                : 'text-amber-900 hover:bg-amber-100/60'
            }`}
          >
            <span>{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black animate-pulse shadow">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* 1. TRANG CHỦ (HOME) */}
      {activeMenu === 'home' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-amber-950 p-6 rounded-3xl shadow-xl border-4 border-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black">
                {(() => {
                  const isCodeOrShort = !user?.full_name || user.full_name.toUpperCase().startsWith('HS2026_') || user.full_name.toUpperCase().startsWith('HS20') || user.full_name.split(' ').length < 2;
                  const matchedEntry = leaderboard.find(lb => lb.student_id === user?.id || lb.email === user?.email || (lb.full_name && lb.full_name.split(' ').length >= 2 && !lb.full_name.toUpperCase().startsWith('HS20')));
                  const displayName = (isCodeOrShort && matchedEntry?.full_name) ? matchedEntry.full_name : (user?.full_name || 'Học sinh');

                  return user?.role === 'student' ? (
                    <>Chào mừng em, <span className="text-white underline decoration-amber-300">{displayName}</span>! 🌟</>
                  ) : (
                    <>Chào mừng em đến với Cổng Học Toán Lớp 2! 🌟</>
                  );
                })()}
              </h2>
              <p className="text-xs font-extrabold text-amber-950 opacity-90">
                Chúc em có một ngày học tập thật vui vẻ và gặt hái nhiều điểm thưởng!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <form onSubmit={handleJoinClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập Mã Lớp (VD: ZJ3KYE)..."
                  value={classCodeInput}
                  onChange={(e) => setClassCodeInput(e.target.value)}
                  className="px-3.5 py-2 bg-white text-slate-800 font-extrabold text-xs rounded-2xl border-2 border-amber-300 focus:outline-none uppercase"
                />
                <button type="submit" className="px-4 py-2 bg-amber-950 text-white font-extrabold text-xs rounded-2xl shadow">
                  Gia Nhập Lớp
                </button>
              </form>
            </div>
          </div>

          {/* BANNER THÔNG BÁO BÀI TẬP TUẦN MỚI GIAO */}
          {uncompletedCount > 0 && (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 rounded-3xl shadow-xl border-4 border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow">
                  🔔
                </div>
                <div>
                  <h4 className="font-black text-base text-yellow-200 flex items-center gap-2">
                    🔔 Bài tập mới! ({uncompletedCount} bài tập chưa làm)
                  </h4>
                  <p className="text-xs font-bold text-white/90">
                    <strong>Toán – {assignments.find(a => !submissions.some(s => s.assignment_id === a.id))?.title || 'Bài tập tuần'}</strong>
                    <br />
                    <span>Giáo viên vừa giao bài tập mới cho em. ⏱️ Thời gian: {assignments.find(a => !submissions.some(s => s.assignment_id === a.id))?.time_limit_minutes || 15} phút</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  const targetAssign = assignments.find(a => !submissions.some(s => s.assignment_id === a.id));
                  setActiveMenu('assignments');
                  if (targetAssign) handleStartAssignment(targetAssign);
                }}
                className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-amber-950 font-black text-xs rounded-2xl shadow-lg uppercase tracking-wider whitespace-nowrap transform active:scale-95 transition-all flex items-center gap-1.5"
              >
                [LÀM BÀI] →
              </button>
            </div>
          )}

          {/* ⭐ BANNER THÔNG TIN TÍCH ĐIỂM HỌC SINH */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 text-amber-950 p-5 rounded-3xl shadow-lg border-2 border-amber-300 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-950 opacity-80 block">⭐ ĐIỂM TÍCH LŨY:</span>
                <h3 className="text-2xl font-black text-white">{myTotalPoints} <span className="text-sm font-bold text-amber-100">ĐIỂM</span></h3>
                <span className="text-[11px] font-extrabold text-amber-950">⭐ {myStars} Sao thưởng</span>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow">
                🏆
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-5 rounded-3xl shadow-lg border-2 border-purple-300 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-200 opacity-90 block">🏆 HẠNG TRONG LỚP:</span>
                <h3 className="text-2xl font-black text-yellow-300">HẠNG #{myRankInClass}</h3>
                <span className="text-[11px] font-extrabold text-purple-100">Thi đua sôi nổi</span>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow">
                🥇
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-500 to-pink-600 text-white p-5 rounded-3xl shadow-lg border-2 border-pink-300 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-rose-200 opacity-90 block">🔥 CHUỖI THÀNH TÍCH:</span>
                <h3 className="text-2xl font-black text-white">5 NGÀY</h3>
                <span className="text-[11px] font-extrabold text-rose-100">Học tập chăm chỉ mỗi ngày</span>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow">
                🔥
              </div>
            </div>
          </div>

          {/* KHU VỰC HUY HIỆU ĐÃ MỞ KHÓA & LỊCH SỬ TÍCH ĐIỂM CỦA EM */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 🎖️ HUY HIỆU THÀNH TÍCH */}
            <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md space-y-3">
              <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Trophy className="w-4 h-4 text-amber-500" /> 🎖️ HUY HIỆU THÀNH TÍCH CỦA EM
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {studentBadges.map((b, idx) => {
                  const isUnlocked = myTotalPoints >= b.minPoints;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border text-center space-y-1 transition-all ${
                        isUnlocked
                          ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 grayscale font-bold'
                      }`}
                    >
                      <div className="text-2xl">{b.icon}</div>
                      <h5 className="font-black text-[11px] leading-tight">{b.title}</h5>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-white border border-amber-200 block w-max mx-auto">
                        {isUnlocked ? '✓ Đã mở' : `Cần ${b.minPoints}đ`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 📜 LỊCH SỬ TÍCH ĐIỂM CỦA EM (CHỈ XEM) */}
            <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md space-y-3">
              <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" /> 📜 LỊCH SỬ TÍCH ĐIỂM CỦA EM
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {myPointLogs.length === 0 ? (
                  <p className="text-xs font-bold text-slate-500 italic text-center py-6">Em chưa có nhật ký tích điểm nào. Hãy hăng hái phát biểu và làm bài tập nhé!</p>
                ) : (
                  myPointLogs.map((log, lIdx) => (
                    <div key={log.id || lIdx} className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 text-xs flex items-center justify-between gap-2 shadow-xs">
                      <div>
                        <span className="font-extrabold text-slate-900">{log.icon || '⭐'} {log.reason}</span>
                        <p className="text-[10px] font-bold text-slate-500">
                          {log.created_at ? new Date(log.created_at).toLocaleDateString('vi-VN') + ' ' + new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black shadow-xs ${log.points_change >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                        {log.points_change >= 0 ? `+${log.points_change}` : log.points_change} điểm
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* HUY HIỆU LỚP ĐANG HỌC */}
          <div className="bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-900">🏫 LỚP ĐANG HỌC:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-amber-100 font-extrabold text-amber-950 px-3 py-1 rounded-xl text-xs border border-amber-300"
              >
                {studentClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Mã Lớp: {c.code})</option>
                ))}
              </select>
            </div>

            {activeClassObj && (
              <span className="text-xs font-black bg-emerald-100 text-emerald-900 px-3 py-1 rounded-xl border border-emerald-300">
                Mã Lớp: {activeClassObj.code}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2. NHIỆM VỤ HÔM NAY */}
      {activeMenu === 'tasks' && (
        <div className="space-y-6">
          {/* NHIỆM VỤ CẦN LÀM */}
          <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              📝 NHIỆM VỤ CẦN LÀM ({tasks.filter(t => !t.is_completed).length})
            </h3>

            <div className="space-y-3">
              {tasks.filter(t => !t.is_completed).length === 0 ? (
                <div className="p-6 bg-emerald-50 rounded-2xl text-center border border-emerald-200">
                  <p className="text-sm font-black text-emerald-900">🎉 Hoan hô! Em đã hoàn thành tất cả nhiệm vụ được giao!</p>
                </div>
              ) : (
                tasks.filter(t => !t.is_completed).map(t => (
                  <div key={t.id} className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{t.title}</h4>
                      <span className="text-xs font-bold text-amber-800">
                        Hạn chót: {t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : 'Trong ngày'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCompleteTask(t.id)}
                      className="px-4 py-2 rounded-2xl font-black text-xs shadow transition-all bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-95 flex items-center gap-1.5"
                    >
                      <span>🚀 NỘP BÀI</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* BÀI ĐÃ NỘP & LỊCH SỬ BÀI LÀM */}
          <div className="bg-white p-6 rounded-3xl border-2 border-emerald-200 shadow-md space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              📚 BÀI ĐÃ NỘP & LỊCH SỬ BÀI LÀM ({tasks.filter(t => t.is_completed).length})
            </h3>

            <div className="space-y-3">
              {tasks.filter(t => t.is_completed).length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-200">
                  <p className="text-xs font-extrabold text-slate-400">Em chưa có bài nộp nào trong mục này.</p>
                </div>
              ) : (
                tasks.filter(t => t.is_completed).map(t => (
                  <div key={t.id} className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{t.title}</h4>
                      <span className="text-xs font-black text-amber-800 block mt-0.5">
                        🟡 Đã nộp – Chờ giáo viên duyệt & chốt điểm
                      </span>
                    </div>

                    <span className="px-3 py-1.5 rounded-xl font-black text-xs bg-amber-100 text-amber-900 border border-amber-300">
                      ⏳ Đang chờ duyệt
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. BÀI TẬP VÀ BÀI KIỂM TRA TUẦN CỦA GIÁO VIÊN GIAO */}
      {activeMenu === 'assignments' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              DANH SÁCH BÀI TẬP & ĐỀ KIỂM TRA ĐÃ GIAO ({assignments.length})
            </h3>
            <button
              onClick={() => loadClassContent(selectedClassId)}
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold rounded-xl text-xs flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tải lại bài tập
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="bg-amber-50/60 p-8 rounded-2xl text-center space-y-2 border border-amber-200">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="font-black text-sm text-slate-700">Chưa có bài tập tuần nào được giao cho em!</h4>
              <p className="text-xs font-bold text-slate-500">Khi Giáo viên giao bài tập tuần hoặc đề kiểm tra, các đề bài sẽ xuất hiện ngay tại đây.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map(a => {
                const sub = submissions.find(s => s.assignment_id === a.id);
                const isOverdue = !sub && a.due_date && new Date() > new Date(a.due_date);

                return (
                  <div key={a.id} className="p-5 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/30 space-y-3 flex flex-col justify-between shadow-sm hover:border-amber-400 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                          📝 Bài Tập Tuần
                        </span>

                        {sub ? (
                          (sub.status === 'finalized_by_teacher' || sub.status === 'teacher_reviewed') ? (
                            <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-950 border border-emerald-400 flex items-center gap-1">
                              🟢 Cô Đã Duyệt ({sub.score > 10 ? Math.round((sub.score / 100) * 10 * 10) / 10 : sub.score}/10 Điểm)
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400 flex items-center gap-1">
                              🟠 Đã Nộp – Chờ Duyệt
                            </span>
                          )
                        ) : isOverdue ? (
                          <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-400 flex items-center gap-1">
                            🔴 Quá Hạn
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400 flex items-center gap-1 animate-pulse">
                            🆕 Chưa Làm
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-base text-slate-900">{a.title}</h4>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1 text-amber-800">
                          <Clock className="w-3.5 h-3.5" /> Hạn thời gian: {a.time_limit_minutes || 15} phút
                        </span>
                        <span className="flex items-center gap-1 text-purple-800">
                          <HelpCircle className="w-3.5 h-3.5" /> {a.questions?.length || 0} câu hỏi
                        </span>
                        <span className="text-slate-500">
                          📅 Ngày giao: {a.created_at ? new Date(a.created_at).toLocaleDateString('vi-VN') : 'Vừa xong'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      {sub ? (
                        (sub.status === 'finalized_by_teacher' || sub.status === 'teacher_reviewed') ? (
                          <div className="p-3 bg-emerald-50 rounded-2xl border-2 border-emerald-300 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-900">
                                🎯 Điểm chính thức: <strong className="text-base text-emerald-700">{sub.score > 10 ? Math.round((sub.score / 100) * 10 * 10) / 10 : sub.score} / 10</strong>
                              </span>
                              <span className="text-[10px] bg-emerald-200 text-emerald-950 font-black px-2 py-0.5 rounded-lg">
                                ✓ Đã chốt
                              </span>
                            </div>

                            {sub.teacher_remark && (
                              <div className="p-2 bg-white rounded-xl border border-emerald-200 text-xs font-bold text-slate-800">
                                <span className="text-emerald-800 font-black block text-[10px]">✍️ Lời nhắn từ Thầy/Cô:</span>
                                "{sub.teacher_remark}"
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedSubmissionDetail({ assignment: a, submission: sub })}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all mt-1"
                            >
                              <Eye className="w-4 h-4" /> [ 👁️ XEM BÀI LÀM & ĐÁP ÁN ĐÚNG ]
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 rounded-2xl border-2 border-amber-300 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-amber-950">🟠 Đã nộp bài thành công</span>
                              <span className="text-[10px] bg-amber-200 text-amber-950 font-bold px-2 py-0.5 rounded-lg">⏳ Chờ duyệt</span>
                            </div>
                            <p className="text-[11px] font-bold text-amber-800">
                              Điểm số & chi tiết đáp án sẽ hiển thị ngay khi Giáo viên duyệt bài nhé!
                            </p>
                          </div>
                        )
                      ) : (
                        <button
                          onClick={() => handleStartAssignment(a)}
                          className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black rounded-2xl shadow-md text-xs uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4 fill-white" /> [LÀM BÀI] NGAY
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. KHO TRÒ CHƠI HỌC TẬP TƯƠNG TÁC (GAME-01 ĐẾN GAME-10) */}
      {activeMenu === 'games' && (
        <div className="space-y-6">
          
          {/* GAME-09: MINI GAMES TÍCH HỢP SẴN (VÒNG QUAY MAY MẮN) */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-3xl shadow-xl border-4 border-purple-300 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                  GAME MINI TÍCH HỢP: VÒNG QUAY TOÁN HỌC MAY MẮN (GAME-09)
                </h3>
                <p className="text-xs font-bold text-purple-200">Quay thưởng mỗi ngày để nhận Sao nề nếp và Huy hiệu Dũng sĩ Toán học!</p>
              </div>

              <button
                onClick={handleSpinWheel}
                disabled={spinning}
                className="bg-yellow-400 hover:bg-yellow-500 text-purple-950 font-black px-5 py-2.5 rounded-2xl shadow-lg text-xs uppercase tracking-wider transition-all transform active:scale-95"
              >
                {spinning ? 'Đang quay...' : '🎡 QUAY NGAY'}
              </button>
            </div>

            {wheelResult && (
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 text-center font-black text-base text-yellow-300 animate-bounce">
                🎉 Phần thưởng của em: {wheelResult}!
              </div>
            )}
          </div>

          {/* DANH SÁCH GAME ĐÃ ĐĂNG KÈM REPLAY & RATING (GAME-01 -> GAME-10) */}
          <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-amber-600" />
              KHO TRÒ CHƠI TOÁN HỌC CỦA LỚP ({games.length})
            </h3>

            {games.length === 0 ? (
              <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
                Chưa có trò chơi nào được giao.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map(g => (
                  <div key={g.id} className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-lg">
                          🎯 Lượt chơi: 3/3
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleLikeGame(g.id)}
                          className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
                        >
                          <Heart className={`w-4 h-4 ${userLikedGames[g.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                          {gameLikes[g.id] || 15}
                        </button>
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-800">{g.title}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">{g.description || 'Trò chơi tương tác môn Toán'}</p>
                    </div>

                    <div className="space-y-2 pt-2">
                      {/* GAME-08: CHƠI CHÍNH THỨC VÀ REPLAY LUYỆN TẬP */}
                      <button
                        onClick={() => handleOpenGameModal(g, 'official')}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2 rounded-xl text-xs text-center shadow block"
                      >
                        🎮 Chơi Tự Động Ghi Điểm
                      </button>

                      <button
                        onClick={() => handleOpenGameModal(g, 'practice')}
                        className="w-full bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold py-1.5 rounded-xl text-xs text-center border border-amber-300 block"
                      >
                        🔄 Chơi Luyện Tập (Replay)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAME-03: SANDBOX IFRAME MODAL CHƠI GAME AN TOÀN */}
      {activePlayGame && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-amber-300 w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            
            {/* GAME MODAL HEADER */}
            <div className="p-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-6 h-6" />
                <div>
                  <h3 className="font-black text-base">{activePlayGame.title}</h3>
                  <span className="text-xs font-bold opacity-90">
                    Chế độ: {gamePlayMode === 'official' ? '🎯 Tính Điểm Chính Thức' : '🔄 Luyện Tập Replay'} | ⏱️ Thời gian chơi: {gameTimerSeconds}s
                  </span>
                </div>
              </div>

              <button
                onClick={handleCloseGameModal}
                className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* GAME-03: IFRAME SANDBOX CÔ LẬP AN TOÀN */}
            <div className="flex-1 bg-slate-900">
              <iframe
                src={activePlayGame.game_url}
                title={activePlayGame.title}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. KHO HỌC LIỆU & BÀI GIẢNG DÀNH CHO HỌC SINH */}
      {activeMenu === 'materials' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              📖 KHO HỌC LIỆU & BÀI GIẢNG DÀNH CHO EM ({materials.length})
            </h3>
            <button
              onClick={() => loadClassContent(selectedClassId)}
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold rounded-xl text-xs flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tải lại học liệu
            </button>
          </div>

          {materials.length === 0 ? (
            <div className="bg-amber-50/60 p-8 rounded-2xl text-center space-y-2 border border-amber-200">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="font-black text-sm text-slate-700">Chưa có học liệu nào được đăng trong lớp!</h4>
              <p className="text-xs font-bold text-slate-500">Khi Giáo viên đăng slide bài giảng, video hay tài liệu ôn tập, các em có thể vào đây học nhé.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {materials.map(m => (
                <div key={m.id} className="p-4 rounded-3xl border-2 border-amber-200 bg-amber-50/40 space-y-3 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-black rounded-xl uppercase tracking-wider">
                        {m.file_type || 'Tài liệu'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString('vi-VN') : 'Mới đăng'}
                      </span>
                    </div>

                    <h4 className="font-black text-sm text-slate-900 line-clamp-2">{m.title}</h4>
                    {m.description && <p className="text-xs font-bold text-slate-600 line-clamp-2">{m.description}</p>}
                  </div>

                  <div className="pt-2 border-t border-amber-200/60">
                    {m.file_type === 'video' || (m.file_url && m.file_url.includes('.mp4')) ? (
                      <div className="space-y-2">
                        <video controls src={m.file_url} className="w-full h-36 rounded-2xl border border-amber-300 object-cover bg-black" />
                        <a
                          href={m.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-2xl text-xs text-center block shadow"
                        >
                          ▶️ Xem Video Toàn Màn Hình
                        </a>
                      </div>
                    ) : (
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-2xl text-xs text-center block shadow flex items-center justify-center gap-1.5"
                      >
                        <BookOpen className="w-4 h-4" /> [MỞ XEM BÀI GIẢNG / TỆP]
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. AI MATH CHAT ASSISTANT */}
      {activeMenu === 'ai' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            TRỢ LÝ HỌC TOÁN LỚP 2 AI
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto p-4 bg-amber-50/50 rounded-2xl border border-amber-200">
            {aiChatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-2xl max-w-md text-xs font-bold ${msg.sender === 'user' ? 'bg-amber-500 text-white' : 'bg-white text-slate-800 border border-amber-200 shadow-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendAiMessage} className="flex gap-2">
            <input
              type="text"
              placeholder="Nhập bài toán hoặc câu hỏi..."
              value={aiChatInput}
              onChange={(e) => setAiChatInput(e.target.value)}
              className="flex-1 p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold"
            />
            <button
              type="submit"
              disabled={aiChatLoading}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-2xl text-xs shadow flex items-center gap-1"
            >
              <Send className="w-4 h-4" /> {aiChatLoading ? 'Đang hỏi...' : 'Gửi'}
            </button>
          </form>
        </div>
      )}

      {/* MODAL LÀM BÀI TRẮC NGHIỆM CHO HỌC SINH */}
      {activeAssignment && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-amber-300 w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            
            {/* QUIZ HEADER */}
            <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">{activeAssignment.title}</h3>
                <span className="text-xs font-bold opacity-90 flex items-center gap-2">
                  ⏱️ Thời gian đếm ngược: {activeAssignment.time_limit_minutes || 15} phút | Câu hỏi {currentQuestionIndex + 1} / {activeAssignment.questions?.length || 0}
                </span>
              </div>

              <button
                onClick={() => setActiveAssignment(null)}
                className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* QUIZ BODY */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {activeAssignment.questions && activeAssignment.questions.length > 0 ? (
                (() => {
                  const q = activeAssignment.questions[currentQuestionIndex];
                  const selectedOpts = userAnswers[q.id] || [];
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-black text-purple-900">
                        <span>CÂU HỎI {currentQuestionIndex + 1} / {activeAssignment.questions.length}:</span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded-md font-black">
                          (+{Math.round((10 / activeAssignment.questions.length) * 10) / 10} Điểm / câu)
                        </span>
                      </div>

                      <h4 className="text-base font-black text-slate-900 bg-amber-50 p-4 rounded-2xl border border-amber-200">
                        {q.question_text}
                      </h4>

                      {q.image_url && (
                        <img src={q.image_url} alt="Question diagram" className="max-h-60 w-auto rounded-2xl border-2 border-purple-200 mx-auto my-2 shadow object-contain" />
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {q.options?.map(opt => {
                          const isChecked = selectedOpts.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSelectOption(q.id, opt.id)}
                              className={`p-4 rounded-2xl border-2 text-left font-extrabold text-xs transition-all flex items-center justify-between ${
                                isChecked
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-102'
                                  : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              <span><strong className="text-sm mr-2">{opt.id}.</strong> {opt.text}</span>
                              {isChecked && <CheckCircle2 className="w-5 h-5 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-8 font-bold text-slate-400">Đề bài không có câu hỏi nào.</div>
              )}
            </div>

            {/* QUIZ FOOTER NAV */}
            <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
              <button
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs disabled:opacity-40"
              >
                ← Câu trước
              </button>

              {currentQuestionIndex < (activeAssignment.questions?.length || 0) - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs shadow"
                >
                  Câu tiếp theo →
                </button>
              ) : (
                <button
                  onClick={handleSubmitAssignment}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-lg uppercase"
                >
                  {isSubmitting ? 'Đang nộp bài...' : '🎯 NỘP BÀI THI'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT BÀI LÀM VÀ ĐÁP ÁN DÀNH CHO HỌC SINH */}
      {selectedSubmissionDetail && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-amber-300 w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
            
            {/* HEADER MODAL */}
            <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-200" />
                <div>
                  <h3 className="font-black text-base sm:text-lg">📋 CHI TIẾT KẾT QUẢ BÀI LÀM CỦA EM</h3>
                  <span className="text-xs font-bold text-emerald-100 block">
                    Đề bài: {selectedSubmissionDetail.assignment.title}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedSubmissionDetail(null)}
                className="p-2 bg-emerald-700/80 hover:bg-emerald-800 text-white rounded-2xl transition-all cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* BODY MODAL */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* SCORE & REMARK CARD */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900 uppercase">🎯 ĐIỂM CHÍNH THỨC CỦA EM:</span>
                  <span className="text-xl font-black text-emerald-700 bg-emerald-200/80 px-4 py-1 rounded-xl shadow-xs">
                    {selectedSubmissionDetail.submission.score > 10 
                      ? Math.round((selectedSubmissionDetail.submission.score / 100) * 10 * 10) / 10 
                      : selectedSubmissionDetail.submission.score} / 10 Điểm
                  </span>
                </div>

                {selectedSubmissionDetail.submission.teacher_remark ? (
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs font-bold text-slate-800">
                    <span className="text-emerald-800 font-black block mb-1">✍️ Lời nhắn / Nhận xét của Thầy/Cô:</span>
                    "{selectedSubmissionDetail.submission.teacher_remark}"
                  </div>
                ) : (
                  <div className="p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs font-bold text-slate-500 italic">
                    Thầy/Cô đã duyệt bài làm và khen ngợi sự nỗ lực của em!
                  </div>
                )}
              </div>

              {/* CHI TIẾT CÂU HỎI VÀ ĐÁP ÁN */}
              <div className="space-y-3">
                <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">
                  📖 BÀI LÀM CHI TIẾT VÀ ĐÁP ÁN ĐÚNG:
                </h4>

                {selectedSubmissionDetail.assignment.questions && selectedSubmissionDetail.assignment.questions.length > 0 ? (
                  selectedSubmissionDetail.assignment.questions.map((q, idx) => {
                    const resp = selectedSubmissionDetail.submission.responses?.find((r: any) => r.question_id === q.id);
                    const isCorrect = resp?.is_correct ?? true;
                    const cleanQText = q.question_text.replace(/^câu\s*\d+\s*:\s*/i, '');

                    return (
                      <div key={q.id || idx} className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-black text-slate-900">
                          <span>Câu {idx + 1}: {cleanQText}</span>
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${isCorrect ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-rose-100 text-rose-950 border border-rose-300'}`}>
                            {isCorrect ? '🟢 ĐÚNG' : '🔴 SAI'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold pt-1">
                          <div className={`p-2.5 rounded-xl border ${isCorrect ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-300'}`}>
                            <span className="text-slate-400 text-[10px] block">Em đã chọn:</span>
                            <span className={`font-black ${isCorrect ? 'text-emerald-950' : 'text-rose-900'}`}>
                              {resp?.selected_options?.join(', ') || 'Đã chọn'}
                            </span>
                          </div>
                          <div className="p-2.5 bg-emerald-100/70 rounded-xl border border-emerald-300">
                            <span className="text-emerald-800 text-[10px] block">Đáp án đúng:</span>
                            <span className="text-emerald-950 font-black">
                              {q.correct_answers?.join(', ') || 'Chính xác'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-xs font-bold text-slate-400">Đề bài không lưu câu hỏi chi tiết.</div>
                )}
              </div>

            </div>

            {/* FOOTER MODAL */}
            <div className="p-4 bg-slate-50 border-t flex items-center justify-end">
              <button
                onClick={() => setSelectedSubmissionDetail(null)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow uppercase tracking-wider cursor-pointer"
              >
                Đóng Cửa Sổ
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
