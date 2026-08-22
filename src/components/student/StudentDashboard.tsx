import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  DailyTask, Assignment, AssignmentQuestion, 
  LearningMaterial, GameItem, AssignmentSubmission, LeaderboardEntry, ClassItem 
} from '../../types';
import { 
  getStudentClasses, joinClassByCode, getDailyTasks, markTaskCompleted,
  getAssignments, submitAssignment, getStudentSubmissions,
  getLearningMaterials, getGames, getClassLeaderboard
} from '../../services/supabase';
import { askAIMathAssistant } from '../../services/aiService';
import confetti from 'canvas-confetti';

import { 
  Home, BookOpen, FileText, Gamepad2, Brain, 
  Award, User as UserIcon, CheckCircle2, AlertCircle, 
  Clock, Send, Sparkles, Trophy, ChevronRight, Check, X, School
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [activeMenu, setActiveMenu] = useState<string>('home');
  const [studentClasses, setStudentClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [studentClassId, setStudentClassId] = useState<string>('');

  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinLoading, setJoinLoading] = useState<boolean>(false);

  // Data State
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // State Làm Bài Tập & Bộ Đếm Thời Gian Từng Câu Hỏi
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [questionTimers, setQuestionTimers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Timer Ref
  const timerIntervalRef = useRef<any>(null);

  // State AI Trợ Lý Toán Học
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [aiChatMessages, setAiChatMessages] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    { sender: 'ai', text: 'Chào em! Rất vui được gặp em. Em có thắc mắc bài toán Lớp 2 nào cứ hỏi trợ lý nhé!' }
  ]);
  const [aiChatLoading, setAiChatLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user?.id) {
      loadStudentData();
    }
  }, [user]);

  useEffect(() => {
    if (studentClassId) {
      loadClassContent(studentClassId);
    }
  }, [studentClassId]);

  // Bộ đếm thời gian riêng từng câu hỏi
  useEffect(() => {
    if (activeAssignment && activeAssignment.questions && activeAssignment.questions.length > 0) {
      const q = activeAssignment.questions[currentQuestionIndex];
      if (q && !selectedAnswers[q.id]) {
        timerIntervalRef.current = setInterval(() => {
          setQuestionTimers(prev => ({
            ...prev,
            [q.id]: (prev[q.id] || 0) + 1
          }));
        }, 1000);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeAssignment, currentQuestionIndex, selectedAnswers]);

  const loadStudentData = async () => {
    try {
      const clsList = await getStudentClasses(user!.id);
      setStudentClasses(clsList);

      if (clsList.length > 0) {
        const targetClass = studentClassId ? (clsList.find(c => c.id === studentClassId) || clsList[0]) : clsList[0];
        setSelectedClass(targetClass);
        setStudentClassId(targetClass.id);
      }
    } catch (err) {
      console.error('Error loading student classes:', err);
    }
  };

  const loadClassContent = async (classId: string) => {
    try {
      const t = await getDailyTasks(classId, user!.id);
      setTasks(t);

      const a = await getAssignments(classId, false);
      setAssignments(a);

      const m = await getLearningMaterials(classId);
      setMaterials(m);

      const g = await getGames(classId);
      setGames(g);

      const s = await getStudentSubmissions(user!.id);
      setSubmissions(s);

      const lb = await getClassLeaderboard(classId);
      setLeaderboard(lb);
    } catch (err) {
      console.error('Error loading class content:', err);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinLoading(true);
    try {
      const cls = await joinClassByCode(joinCodeInput, user!.id);
      alert(`🎉 Gia nhập thành công lớp ${cls.name} (Mã Lớp: ${cls.code})!`);
      setJoinCodeInput('');
      setStudentClassId(cls.id);
      await loadStudentData();
    } catch (err: any) {
      alert(err.message || 'Lỗi gia nhập lớp.');
    } finally {
      setJoinLoading(false);
    }
  };

  // HỌC SINH BẤM "HOÀN THÀNH" NHIỆM VỤ HÀNG NGÀY
  const handleCompleteTask = async (taskId: string) => {
    if (!studentClassId) return;
    try {
      await markTaskCompleted(taskId, user!.id);
      confetti({ particleCount: 60, spread: 60 });
      loadClassContent(studentClassId);
    } catch (err: any) {
      alert('Lỗi hoàn thành nhiệm vụ: ' + err.message);
    }
  };

  // CHỌN ĐÁP ÁN VÀ DỪNG NGAY BỘ ĐẾM THỜI GIAN CỦA CÂU ĐÓ
  const handleSelectOption = (questionId: string, optionId: string) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: [optionId]
    }));
  };

  // NỘP BÀI TẬP VÀ LƯU BỘ ĐẾM THỜI GIAN THEO TỪNG CÂU
  const handleSubmitAssignment = async () => {
    if (!activeAssignment || !activeAssignment.questions) return;
    setIsSubmitting(true);

    try {
      const responses = activeAssignment.questions.map(q => {
        const chosen = selectedAnswers[q.id] || [];
        const isCorrect = chosen.length > 0 && q.correct_answers.includes(chosen[0]);
        const timeSpent = questionTimers[q.id] || 0;

        return {
          question_id: q.id,
          selected_options: chosen,
          time_spent_seconds: timeSpent,
          is_correct: isCorrect
        };
      });

      await submitAssignment(activeAssignment.id, user!.id, responses);

      confetti({ particleCount: 100, spread: 80 });
      alert('🎉 Chúc mừng em đã hoàn thành bài tập! Điểm số và thời gian làm bài của từng câu đã được ghi nhận.');
      
      setActiveAssignment(null);
      if (studentClassId) loadClassContent(studentClassId);
    } catch (err: any) {
      alert('Lỗi nộp bài: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
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

  // 9 DANH MỤC GIAO DIỆN HỌC SINH
  const menuItems = [
    { id: 'home', label: '🏠 Trang chủ' },
    { id: 'tasks', label: '📚 Nhiệm vụ hôm nay' },
    { id: 'assignments', label: '📝 Bài tập' },
    { id: 'games', label: '🎮 Trò chơi' },
    { id: 'materials', label: '📖 Học liệu' },
    { id: 'ai', label: '🤖 Trợ lý Toán học AI' },
    { id: 'results', label: '📊 Kết quả & tiến bộ' },
    { id: 'leaderboard', label: '🏆 Bảng xếp hạng' },
    { id: 'profile', label: '👤 Hồ sơ' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* 9 DANH MỤC MENU NAV CHO HỌC SINH */}
      <div className="bg-white p-2 rounded-3xl border-2 border-amber-200 shadow-md flex items-center gap-1.5 overflow-x-auto">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveMenu(item.id); setActiveAssignment(null); }}
            className={`whitespace-nowrap px-3.5 py-2 rounded-2xl font-black text-xs transition-all ${
              activeMenu === item.id
                ? 'bg-amber-500 text-white shadow-md scale-105'
                : 'text-amber-900 hover:bg-amber-100/60'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 1. TRANG CHỦ (HOME) */}
      {activeMenu === 'home' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-amber-950 p-6 rounded-3xl shadow-xl border-4 border-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black">
                {user?.role === 'student' ? (
                  <>Chào mừng em, <span className="text-white underline decoration-amber-300">{user?.full_name}</span>! 🌟</>
                ) : (
                  <>Chào mừng em đến với Cổng Học Toán Lớp 2! 🌟</>
                )}
              </h2>

              <p className="text-xs font-bold text-amber-950/90 max-w-xl">
                Cùng khám phá môn Toán Lớp 2 thật thú vị với những nhiệm vụ hôm nay, trò chơi hấp dẫn và Trợ lý AI dễ thương nhé!
              </p>

              {/* THÔNG TIN LỚP HỌC ĐANG THAM GIA */}
              {selectedClass ? (
                <div className="flex items-center gap-2 mt-2 bg-amber-900/10 px-3.5 py-2 rounded-2xl border border-amber-950/20 w-fit">
                  <School className="w-4 h-4 text-amber-950" />
                  <span className="text-xs font-black text-amber-950">
                    Lớp đang học: <strong className="text-amber-950 bg-amber-200/90 px-2.5 py-0.5 rounded-lg border border-amber-300">{selectedClass.name}</strong> (Mã Lớp: <span className="font-mono text-purple-950 font-black">{selectedClass.code}</span>)
                  </span>

                  {studentClasses.length > 1 && (
                    <select
                      value={selectedClass.id}
                      onChange={(e) => {
                        const targetCls = studentClasses.find(c => c.id === e.target.value);
                        if (targetCls) {
                          setSelectedClass(targetCls);
                          setStudentClassId(targetCls.id);
                        }
                      }}
                      className="ml-2 text-[11px] font-black bg-white text-slate-800 border border-amber-300 rounded-xl px-2 py-1 focus:outline-none"
                    >
                      {studentClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="text-xs font-black text-amber-950 bg-amber-200/80 px-3 py-1.5 rounded-xl border border-amber-300 w-fit">
                  ⚠️ Em chưa gia nhập lớp học nào. Nhập Mã Lớp ở bên phải để gia nhập nhé!
                </div>
              )}
            </div>

            <div className="bg-white/90 p-4 rounded-2xl border-2 border-amber-300 shadow text-center min-w-[220px]">
              <div className="text-2xl font-black text-amber-800">
                {tasks.filter(t => t.is_completed).length}/{tasks.length}
              </div>
              <div className="text-[11px] font-extrabold text-amber-900 mb-2">Nhiệm vụ đã hoàn thành</div>

              {/* FORM GIA NHẬP LỚP BẰNG MÃ (JOIN CODE) */}
              <form onSubmit={handleJoinClass} className="space-y-1.5 pt-2 border-t border-amber-200">
                <input
                  type="text"
                  placeholder="Nhập Mã Lớp (VD: 2A1CODE)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full p-2 bg-amber-50 border border-amber-300 rounded-xl text-xs font-black text-center uppercase focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-1.5 rounded-xl text-[11px] shadow transition-all active:scale-95"
                >
                  {joinLoading ? 'Đang vào...' : 'Gia Nhập Lớp Mới'}
                </button>
              </form>
            </div>
          </div>

          {/* NHIỆM VỤ & BÀI TẬP NHANH */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              onClick={() => setActiveMenu('tasks')}
              className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md hover:border-amber-400 cursor-pointer transition-all space-y-2"
            >
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl w-fit">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-800">Nhiệm Vụ Hôm Nay</h3>
              <p className="text-xs text-slate-600 font-bold">Xem và hoàn thành các nhiệm vụ giáo viên giao.</p>
            </div>

            <div 
              onClick={() => setActiveMenu('assignments')}
              className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md hover:border-amber-400 cursor-pointer transition-all space-y-2"
            >
              <div className="p-3 bg-blue-100 text-blue-800 rounded-2xl w-fit">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-800">Bài Tập & Kiểm Tra</h3>
              <p className="text-xs text-slate-600 font-bold">Làm các bài trắc nghiệm Toán lớp 2 với bộ đếm thời gian.</p>
            </div>

            <div 
              onClick={() => setActiveMenu('ai')}
              className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md hover:border-amber-400 cursor-pointer transition-all space-y-2"
            >
              <div className="p-3 bg-purple-100 text-purple-800 rounded-2xl w-fit">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-800">Trợ Lý AI Toán Học</h3>
              <p className="text-xs text-slate-600 font-bold">Hỏi đáp kiến thức Toán, được gợi ý cách giải bài tập.</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. NHIỆM VỤ HÔM NAY (TASKS) */}
      {activeMenu === 'tasks' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            DANH SÁCH NHIỆM VỤ HÀNG NGÀY ({tasks.length})
          </h3>

          {tasks.length === 0 ? (
            <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
              Hôm nay giáo viên chưa giao nhiệm vụ nào cho lớp.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tasks.map(t => (
                <div key={t.id} className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">{t.title}</h4>
                    <p className="text-[11px] font-bold text-amber-800 mt-0.5">Hạn chót: {t.due_date}</p>
                  </div>
                  {t.is_completed ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Đã hoàn thành
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCompleteTask(t.id)}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs shadow transition-all"
                    >
                      Bấm Hoàn Thành
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. BÀI TẬP & KIỂM TRA (ASSIGNMENTS) */}
      {activeMenu === 'assignments' && (
        <div className="space-y-6">
          {!activeAssignment ? (
            <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                DANH SÁCH BÀI TẬP VÀ ĐỀ KIỂM TRA ({assignments.length})
              </h3>

              {assignments.length === 0 ? (
                <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
                  Chưa có bài tập nào được giao cho lớp.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignments.map(a => {
                    const sub = submissions.find(s => s.assignment_id === a.id);
                    return (
                      <div key={a.id} className="p-5 rounded-2xl border-2 border-amber-200 bg-white shadow-sm space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              a.type === 'weekly_test' ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                              {a.type === 'weekly_test' ? 'Đề Kiểm Tra Tuần' : 'Bài Tập Ôn Luyện'}
                            </span>
                            <h4 className="font-extrabold text-base text-slate-900 mt-1">{a.title}</h4>
                          </div>
                          <span className="text-xs font-bold text-amber-800">Hạn: {a.due_date || 'Không có'}</span>
                        </div>

                        {sub ? (
                          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300 flex items-center justify-between text-xs font-bold text-emerald-900">
                            <span>✅ Đã nộp bài</span>
                            <span className="font-black text-sm text-emerald-700">Điểm: {sub.score} / 100</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveAssignment(a);
                              setCurrentQuestionIndex(0);
                              setSelectedAnswers({});
                              setQuestionTimers({});
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 rounded-xl text-xs shadow flex items-center justify-center gap-1 transition-all"
                          >
                            Bắt Đầu Làm Bài <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* GIAO DIỆN LÀM BÀI TRẮC NGHIỆM VỚI BỘ ĐẾM THỜI GIAN THEO TỪNG CÂU */
            <div className="bg-white p-6 rounded-3xl border-4 border-amber-300 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-amber-200">
                <div>
                  <h3 className="text-lg font-black text-amber-950">{activeAssignment.title}</h3>
                  <p className="text-xs font-bold text-amber-800">
                    Câu {currentQuestionIndex + 1} / {activeAssignment.questions?.length || 0}
                  </p>
                </div>

                {/* BỘ ĐẾM THỜI GIAN THEO TỪNG CÂU HỎI */}
                <div className="bg-amber-100 px-4 py-2 rounded-2xl border border-amber-300 flex items-center gap-2 text-amber-950 font-black text-sm">
                  <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
                  Thời gian câu này: {questionTimers[activeAssignment.questions![currentQuestionIndex]?.id] || 0}s
                </div>
              </div>

              {activeAssignment.questions && activeAssignment.questions.length > 0 && (
                <div className="space-y-4">
                  {/* CÂU HỎI HIỆN TẠI */}
                  <div className="bg-amber-50/80 p-5 rounded-2xl border-2 border-amber-200 space-y-3">
                    <h4 className="font-black text-base text-slate-900">
                      Câu {currentQuestionIndex + 1}: {activeAssignment.questions[currentQuestionIndex].question_text}
                    </h4>

                    {activeAssignment.questions[currentQuestionIndex].image_url && (
                      <img 
                        src={activeAssignment.questions[currentQuestionIndex].image_url} 
                        alt="Question" 
                        className="max-h-48 rounded-xl border border-amber-300 object-contain"
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {activeAssignment.questions[currentQuestionIndex].options.map(opt => {
                        const qId = activeAssignment.questions![currentQuestionIndex].id;
                        const isSelected = selectedAnswers[qId]?.includes(opt.id);

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectOption(qId, opt.id)}
                            className={`p-3.5 rounded-2xl border-2 font-bold text-xs text-left transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-amber-500 border-amber-600 text-white shadow-md'
                                : 'bg-white border-amber-200 text-slate-700 hover:border-amber-300'
                            }`}
                          >
                            <span>{opt.text}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* NÚT CHUYỂN CÂU HỎI VÀ NỘP BÀI */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl disabled:opacity-50"
                    >
                      Câu trước
                    </button>

                    {currentQuestionIndex < activeAssignment.questions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow"
                      >
                        Câu tiếp theo
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitAssignment}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg animate-bounce"
                      >
                        {isSubmitting ? 'Đang nộp bài...' : 'Hoàn Thành & Nộp Bài'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. TRÒ CHƠI (GAMES) */}
      {activeMenu === 'games' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-amber-600" />
            KHO TRÒ CHƠI HỌC TẬP TƯƠNG TÁC ({games.length})
          </h3>

          {games.length === 0 ? (
            <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
              Chưa có trò chơi nào được tải lên cho lớp.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map(g => (
                <div key={g.id} className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">{g.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">{g.description || 'Trò chơi tương tác môn Toán'}</p>
                  </div>
                  <a
                    href={g.game_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2 rounded-xl text-xs text-center shadow block"
                  >
                    Vào Chơi Game 🎮
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. HỌC LIỆU (MATERIALS) */}
      {activeMenu === 'materials' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            KHO HỌC LIỆU TOÁN LỚP 2 ({materials.length})
          </h3>

          {materials.length === 0 ? (
            <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
              Chưa có học liệu nào được đăng cho lớp.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {materials.map(m => (
                <div key={m.id} className="p-4 rounded-2xl border-2 border-amber-200 bg-white space-y-3 flex flex-col justify-between shadow-sm">
                  <div>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-black uppercase">
                      {m.file_type.toUpperCase()}
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-800 mt-1">{m.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{m.description}</p>
                  </div>
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2 rounded-xl text-xs text-center shadow block"
                  >
                    Xem Học Liệu 📖
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. TRỢ LÝ TOÁN HỌC AI */}
      {activeMenu === 'ai' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4 max-w-3xl mx-auto">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            TRỢ LÝ TOÁN HỌC AI - GIẢI ĐÁP TOÁN LỚP 2
          </h3>

          <div className="h-80 overflow-y-auto p-4 bg-amber-50/50 border-2 border-amber-200 rounded-2xl space-y-3">
            {aiChatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-2xl text-xs font-bold max-w-md ${
                  msg.sender === 'user'
                    ? 'bg-amber-500 text-white rounded-br-none shadow'
                    : 'bg-white text-slate-800 border border-amber-200 rounded-bl-none shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {aiChatLoading && (
              <div className="text-xs font-bold text-amber-800 animate-pulse">Trợ lý AI đang giải toán...</div>
            )}
          </div>

          <form onSubmit={handleSendAiMessage} className="flex gap-2">
            <input
              type="text"
              placeholder="Nhập câu hỏi Toán Lớp 2 (VD: 15 + 27 bằng bao nhiêu?)..."
              value={aiChatInput}
              onChange={(e) => setAiChatInput(e.target.value)}
              className="flex-1 p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={aiChatLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-5 py-3 rounded-2xl text-xs shadow flex items-center gap-1"
            >
              <Send className="w-4 h-4" /> Gửi
            </button>
          </form>
        </div>
      )}

      {/* 7. KẾT QUẢ & TIẾN BỘ (RESULTS) */}
      {activeMenu === 'results' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            LỊCH SỬ KẾT QUẢ LÀM BÀI ({submissions.length})
          </h3>

          {submissions.length === 0 ? (
            <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
              Em chưa thực hiện bài nộp nào. Hãy vào mục Bài Tập để làm bài nhé!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-amber-100 text-amber-900 font-black">
                    <th className="p-3 rounded-l-xl">Tên bài tập</th>
                    <th className="p-3">Ngày nộp</th>
                    <th className="p-3">Điểm số</th>
                    <th className="p-3 rounded-r-xl">Nhận xét của Giáo viên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {submissions.map(s => (
                    <tr key={s.id} className="hover:bg-amber-50/50 font-bold">
                      <td className="p-3 font-extrabold text-slate-900">
                        {(s.assignment as any)?.title || 'Bài tập trắc nghiệm'}
                      </td>
                      <td className="p-3">{new Date(s.submitted_at).toLocaleDateString('vi-VN')}</td>
                      <td className="p-3 font-black text-emerald-700 text-sm">{s.score} / 100</td>
                      <td className="p-3 text-slate-600">{s.teacher_remark || 'Giáo viên chưa có nhận xét thêm'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 8. BẢNG XẾP HẠNG (LEADERBOARD) */}
      {activeMenu === 'leaderboard' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            BẢNG XẾP HẠNG THÀNH TÍCH LỚP HỌC
          </h3>

          {leaderboard.length === 0 ? (
            <div className="bg-amber-50 p-6 rounded-2xl text-center text-xs font-bold text-amber-800 border border-amber-200">
              Chưa có dữ liệu xếp hạng. Hãy hoàn thành nhiệm vụ để tích lũy điểm số nhé!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-amber-400 text-amber-950 font-black">
                    <th className="p-3 rounded-l-xl text-center">Hạng</th>
                    <th className="p-3">Học sinh</th>
                    <th className="p-3 text-center">Nhiệm vụ</th>
                    <th className="p-3 text-center">Điểm Bài tập</th>
                    <th className="p-3 text-center">Điểm Kiểm tra</th>
                    <th className="p-3 text-center rounded-r-xl">Tổng điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {leaderboard.map(entry => (
                    <tr key={entry.student_id} className={`font-bold ${entry.student_id === user?.id ? 'bg-amber-100/80' : 'hover:bg-amber-50'}`}>
                      <td className="p-3 text-center font-black text-sm">
                        {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : entry.rank}
                      </td>
                      <td className="p-3 font-extrabold text-slate-900">{entry.student_name}</td>
                      <td className="p-3 text-center text-slate-700">{entry.tasks_completed}</td>
                      <td className="p-3 text-center text-slate-700">{entry.assignment_score}</td>
                      <td className="p-3 text-center text-slate-700">{entry.test_score}</td>
                      <td className="p-3 text-center font-black text-amber-800 text-sm">{entry.total_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 9. HỒ SƠ CÁ NHÂN (PROFILE) */}
      {activeMenu === 'profile' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md max-w-md mx-auto space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-amber-600" />
            HỒ SƠ HỌC SINH
          </h3>

          <div className="space-y-3 text-xs font-bold text-slate-700">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <span className="text-slate-500 block text-[10px]">Họ và Tên:</span>
              <span className="text-sm font-extrabold text-slate-900">{user?.full_name}</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <span className="text-slate-500 block text-[10px]">Email / Tên đăng nhập:</span>
              <span className="text-slate-900">{user?.email}</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <span className="text-slate-500 block text-[10px]">Vai trò hệ thống:</span>
              <span className="text-emerald-700 font-extrabold uppercase">{user?.role}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
