import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  DailyTask, Assignment, AssignmentQuestion, 
  LearningMaterial, GameItem, AssignmentSubmission, LeaderboardEntry 
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
  Clock, Send, Sparkles, Trophy, ChevronRight, Check, X
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [activeMenu, setActiveMenu] = useState<string>('home');
  const [studentClassId, setStudentClassId] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinLoading, setJoinLoading] = useState<boolean>(false);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinLoading(true);
    try {
      const cls = await joinClassByCode(joinCodeInput, user!.id);
      alert(`🎉 Gia nhập thành công lớp ${cls.name}!`);
      setJoinCodeInput('');
      loadStudentData();
    } catch (err: any) {
      alert(err.message || 'Lỗi gia nhập lớp.');
    } finally {
      setJoinLoading(false);
    }
  };
  
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
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
    { role: 'model', content: '🌟 Chào em! Trợ lý Toán rất vui được đồng hành cùng em. Em có thắc mắc gì về bài học Toán hôm nay không nè?' }
  ]);
  const [inputChat, setInputChat] = useState<string>('');
  const [aiChatLoading, setAiChatLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user?.id) {
      loadStudentData();
    }
  }, [user]);

  // Bộ đếm thời gian riêng từng câu hỏi
  useEffect(() => {
    if (activeAssignment && activeAssignment.questions && activeAssignment.questions.length > 0) {
      const q = activeAssignment.questions[currentQuestionIndex];
      if (q && !selectedAnswers[q.id]) {
        // Bắt đầu đếm thời gian cho câu hiện tại nếu chưa chọn đáp án
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
      if (clsList.length > 0) {
        const classId = clsList[0].id;
        setStudentClassId(classId);

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
      }
    } catch (err) {
      console.error('Error loading student data:', err);
    }
  };

  // HỌC SINH BẤM "HOÀN THÀNH" NHIỆM VỤ HÀNG NGÀY
  const handleCompleteTask = async (taskId: string) => {
    if (!studentClassId) return;
    try {
      await markTaskCompleted(taskId, user!.id);
      confetti({ particleCount: 60, spread: 60 });
      loadStudentData();
    } catch (err: any) {
      alert('Lỗi hoàn thành nhiệm vụ: ' + err.message);
    }
  };

  // CHỌN ĐÁP ÁN VÀ DỪNG NGAY BỘ ĐẾM THỜI GIAN CỦA CÂU ĐÓ
  const handleSelectOption = (questionId: string, optionId: string) => {
    // Dừng timer của câu này
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
      confetti({ particleCount: 100, spread: 70 });
      alert('Em đã nộp bài thành công! Hãy đợi Giáo viên chốt điểm và nhận xét nhé.');
      setActiveAssignment(null);
      loadStudentData();
    } catch (err: any) {
      alert('Lỗi nộp bài: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // CHAT TRỢ LÝ TOÁN AI
  const handleSendAIChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChat.trim()) return;

    const userText = inputChat;
    setInputChat('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: userText }];
    setChatMessages(newHistory);
    setAiChatLoading(true);

    try {
      const aiReply = await askAIMathAssistant(userText, newHistory);
      setChatMessages([...newHistory, { role: 'model', content: aiReply }]);
    } catch {
      setChatMessages([...newHistory, { role: 'model', content: '🤖 Thầy/Cô AI đang bận một chút, em hãy thử hỏi lại nhé!' }]);
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
                Chào mừng em, <span className="text-white underline">{user?.full_name}</span>! 🌟
              </h2>
              <p className="text-xs font-bold text-amber-950/90 max-w-xl">
                Cùng khám phá môn Toán Lớp 2 thật thú vị với những nhiệm vụ hôm nay, trò chơi hấp dẫn và Trợ lý AI dễ thương nhé!
              </p>
            </div>
            <div className="bg-white/90 p-4 rounded-2xl border-2 border-amber-300 shadow text-center min-w-[200px]">
              <div className="text-2xl font-black text-amber-800">
                {tasks.filter(t => t.is_completed).length}/{tasks.length}
              </div>
              <div className="text-[11px] font-extrabold text-amber-900 mb-2">Nhiệm vụ đã làm</div>

              {/* FORM GIA NHẬP LỚP BẰNG MÃ (JOIN CODE) */}
              <form onSubmit={handleJoinClass} className="space-y-1 pt-2 border-t border-amber-200">
                <input
                  type="text"
                  placeholder="Nhập Mã Lớp (VD: 2A1CODE)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full p-1.5 bg-amber-50 border border-amber-300 rounded-xl text-[11px] font-bold text-center uppercase"
                />
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-1 rounded-xl text-[10px] shadow"
                >
                  {joinLoading ? 'Đang vào...' : 'Gia Nhập Lớp'}
                </button>
              </form>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onClick={() => setActiveMenu('tasks')} className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-sm hover:border-amber-400 cursor-pointer space-y-2">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl w-fit"><BookOpen className="w-6 h-6" /></div>
              <h3 className="text-sm font-black text-slate-900">Nhiệm Vụ Hôm Nay</h3>
              <p className="text-xs font-bold text-slate-600">Xem và hoàn thành các nhiệm vụ giáo viên giao.</p>
            </div>

            <div onClick={() => setActiveMenu('assignments')} className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-sm hover:border-amber-400 cursor-pointer space-y-2">
              <div className="p-3 bg-blue-100 text-blue-800 rounded-2xl w-fit"><FileText className="w-6 h-6" /></div>
              <h3 className="text-sm font-black text-slate-900">Bài Tập & Kiểm Tra</h3>
              <p className="text-xs font-bold text-slate-600">Làm các bài trắc nghiệm Toán lớp 2 với bộ đếm thời gian.</p>
            </div>

            <div onClick={() => setActiveMenu('ai')} className="bg-white p-5 rounded-3xl border-2 border-purple-200 shadow-sm hover:border-purple-400 cursor-pointer space-y-2">
              <div className="p-3 bg-purple-100 text-purple-800 rounded-2xl w-fit"><Brain className="w-6 h-6" /></div>
              <h3 className="text-sm font-black text-purple-950">Trợ Lý AI Toán Học</h3>
              <p className="text-xs font-bold text-slate-600">Hỏi đáp kiến thức Toán, được gợi ý cách giải bài tập.</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. NHIỆM VỤ HÔM NAY (TÔ ĐỎ CHƯA HOÀN THÀNH, HOÀN THÀNH RÕ RÀNG KHÔNG NHẤP LẠI) */}
      {activeMenu === 'tasks' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h2 className="text-base font-black text-amber-950 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            NHIỆM VỤ HÔM NAY
          </h2>

          {tasks.length === 0 ? (
            <div className="text-xs font-bold text-slate-500 text-center py-6">Hôm nay không có nhiệm vụ nào!</div>
          ) : (
            <div className="space-y-3">
              {tasks.map(t => (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                    t.is_completed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950' // TÔ ĐỎ NHIỆM VỤ CHƯA HOÀN THÀNH
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {t.is_completed ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
                    )}
                    <div>
                      <h4 className="text-sm font-black">{t.title}</h4>
                      <p className="text-[11px] font-bold opacity-80">Ngày giao: {t.due_date}</p>
                    </div>
                  </div>

                  {t.is_completed ? (
                    <span className="bg-emerald-200 text-emerald-900 font-extrabold text-xs px-4 py-2 rounded-xl border border-emerald-300">
                      ✓ Đã hoàn thành
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCompleteTask(t.id)}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow transition transform active:scale-95"
                    >
                      Hoàn thành
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. BÀI TẬP & BỘ ĐẾM THỜI GIAN TỪNG CÂU HỎI */}
      {activeMenu === 'assignments' && !activeAssignment && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h2 className="text-base font-black text-amber-950">DANH SÁCH BÀI TẬP VÀ BÀI KIỂM TRA (GIÁO VIÊN ĐÃ CHỐT)</h2>
          
          {assignments.length === 0 ? (
            <div className="text-xs font-bold text-slate-500 text-center py-6">Chưa có bài tập nào được chốt cho em.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map(a => {
                const sub = submissions.find(s => s.assignment_id === a.id);
                return (
                  <div key={a.id} className="bg-amber-50/50 p-5 rounded-3xl border-2 border-amber-200 space-y-3">
                    <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full uppercase">
                      {a.type === 'weekly_test' ? 'Bài Kiểm Tra Hằng Tuần' : 'Bài Tập Trắc Nghiệm'}
                    </span>
                    <h3 className="text-base font-black text-slate-900">{a.title}</h3>

                    {sub ? (
                      <div className="bg-emerald-100/70 p-3 rounded-2xl border border-emerald-300 text-xs font-bold text-emerald-950 space-y-1">
                        <div>Status: {sub.status === 'finalized_by_teacher' ? '✅ GV Đã Chốt Kết Quả' : '⏳ Đã Nộp (Chờ GV Chốt)'}</div>
                        {sub.status === 'finalized_by_teacher' && (
                          <div className="text-sm font-black text-emerald-800">
                            Điểm của em: {sub.score}/100
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveAssignment(a);
                          setCurrentQuestionIndex(0);
                          setSelectedAnswers({});
                          setQuestionTimers({});
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 rounded-2xl text-xs shadow flex items-center justify-center gap-1"
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
      )}

      {/* QUIZ RUNNER CÓ BỘ ĐẾM THỜI GIAN RIÊNG TỪNG CÂU HỎI */}
      {activeAssignment && activeAssignment.questions && activeAssignment.questions.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border-4 border-amber-300 shadow-xl space-y-5 max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-amber-950">{activeAssignment.title}</h3>
            {/* ĐỒNG HỒ ĐẾM THỜI GIAN RIÊNG TỪNG CÂU HỎI */}
            <div className="bg-amber-100 text-amber-950 px-3 py-1.5 rounded-2xl font-black text-xs flex items-center gap-1.5 border border-amber-400">
              <Clock className="w-4 h-4 text-amber-700 animate-spin" />
              Thời gian câu này: <span className="text-rose-600 text-sm font-black">{questionTimers[activeAssignment.questions[currentQuestionIndex].id] || 0}s</span>
            </div>
          </div>

          {/* CÂU HỎI HIỆN TẠI */}
          {(() => {
            const q = activeAssignment.questions[currentQuestionIndex];
            const isAnswered = !!selectedAnswers[q.id];

            return (
              <div className="space-y-4">
                <div className="text-xs font-extrabold text-amber-800">
                  Câu {currentQuestionIndex + 1} / {activeAssignment.questions.length}:
                </div>

                <div className="text-base font-black text-slate-900">{q.question_text}</div>

                {q.image_url && (
                  <img src={q.image_url} alt="Minh họa" className="max-h-48 object-cover rounded-2xl border-2 border-amber-200" />
                )}

                {/* ĐÁP ÁN LỰA CHỌN */}
                <div className="space-y-2">
                  {q.options.map(opt => {
                    const isSelected = selectedAnswers[q.id]?.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectOption(q.id, opt.id)}
                        className={`w-full p-3 rounded-2xl border-2 text-left font-bold text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                            : 'bg-amber-50/50 hover:bg-amber-100 text-slate-800 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{opt.text}</span>
                        </div>
                        {opt.image_url && <img src={opt.image_url} alt="Opt" className="w-10 h-10 object-cover rounded-lg" />}
                      </button>
                    );
                  })}
                </div>

                {/* NÚT ĐIỀU HƯỚNG CÂU HỎI */}
                <div className="flex items-center justify-between pt-4 border-t border-amber-100">
                  <button
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs rounded-xl disabled:opacity-40"
                  >
                    Câu trước
                  </button>

                  {currentQuestionIndex < activeAssignment.questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow"
                    >
                      Câu tiếp theo
                    </button>
                  ) : (
                    <button
                      disabled={isSubmitting}
                      onClick={handleSubmitAssignment}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow"
                    >
                      {isSubmitting ? 'Đang nộp...' : 'NỘP BÀI NGAY'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. TRÒ CHƠI */}
      {activeMenu === 'games' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h2 className="text-base font-black text-amber-950">🎮 TRÒ CHƠI TOÁN HỌC LUYỆN TẬP</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {games.map(g => (
              <div key={g.id} className="bg-amber-50 p-5 rounded-3xl border-2 border-amber-200 space-y-2">
                <h3 className="text-sm font-black text-slate-900">{g.title}</h3>
                <a
                  href={g.game_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow"
                >
                  Chơi Ngay
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. HỌC LIỆU */}
      {activeMenu === 'materials' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h2 className="text-base font-black text-amber-950">📖 HỌC LIỆU BÀI GIẢNG</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {materials.map(m => (
              <div key={m.id} className="bg-amber-50 p-4 rounded-3xl border-2 border-amber-200 space-y-2">
                <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md uppercase">{m.file_type}</span>
                <h3 className="text-xs font-black text-slate-900">{m.title}</h3>
                <a href={m.file_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-amber-700 underline block">Xem bài giảng</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TRỢ LÝ TOÁN HỌC AI */}
      {activeMenu === 'ai' && (
        <div className="bg-white p-6 rounded-3xl border-4 border-purple-200 shadow-xl space-y-4 max-w-3xl mx-auto">
          <h2 className="text-base font-black text-purple-950 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            TRỢ LÝ TOÁN HỌC AI
          </h2>

          <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 h-80 overflow-y-auto space-y-3">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-bold ${
                  msg.role === 'user'
                    ? 'bg-amber-500 text-white rounded-br-none shadow'
                    : 'bg-white text-slate-800 border border-purple-200 rounded-bl-none shadow'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiChatLoading && (
              <div className="text-xs font-bold text-purple-700 animate-pulse">Trợ lý AI đang suy nghĩ câu trả lời...</div>
            )}
          </div>

          <form onSubmit={handleSendAIChat} className="flex gap-2">
            <input
              type="text"
              placeholder="Hỏi Thầy/Cô AI về môn Toán..."
              value={inputChat}
              onChange={(e) => setInputChat(e.target.value)}
              className="flex-1 p-3 bg-purple-50 border-2 border-purple-200 rounded-2xl text-xs font-bold focus:outline-none"
            />
            <button
              type="submit"
              disabled={aiChatLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black px-5 py-3 rounded-2xl text-xs shadow flex items-center gap-1"
            >
              <Send className="w-4 h-4" /> Gửi
            </button>
          </form>
        </div>
      )}

      {/* 7. KẾT QUẢ & TIẾN BỘ (CHỈ THẤY CHI TIẾT ĐÚNG XANH/SAI ĐỎ SAU KHI GV CHỐT) */}
      {activeMenu === 'results' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h2 className="text-base font-black text-amber-950">📊 KẾT QUẢ & TIẾN BỘ HỌC TẬP</h2>

          <div className="space-y-3">
            {submissions.map(s => {
              const assign = assignments.find(a => a.id === s.assignment_id);
              const isFinalized = s.status === 'finalized_by_teacher';

              return (
                <div key={s.id} className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-900">{assign?.title || 'Bài tập Toán'}</h3>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                      isFinalized ? 'bg-emerald-200 text-emerald-950' : 'bg-amber-200 text-amber-950'
                    }`}>
                      {isFinalized ? '✅ Giáo viên đã CHỐT' : '⏳ Đã nộp - Chờ Giáo viên duyệt'}
                    </span>
                  </div>

                  {isFinalized ? (
                    <div className="space-y-2 pt-2 border-t border-amber-200">
                      <div className="text-base font-black text-emerald-700">Điểm số: {s.score}/100</div>
                      <div className="text-xs font-bold text-slate-800">GV Nhận xét: "{s.teacher_remark}"</div>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-amber-800 italic">
                      Chi tiết câu trả lời đúng màu xanh / sai màu đỏ sẽ được hiển thị ngay sau khi Giáo viên chốt điểm!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. BẢNG XẾP HẠNG THỰC TẾ TRONG LỚP */}
      {activeMenu === 'leaderboard' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-4">
          <h2 className="text-base font-black text-amber-950 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            BẢNG XẾP HẠNG TOÀN BỘ HỌC SINH TRONG LỚP (DỮ LIỆU THỰC TẾ)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-amber-100 text-amber-950 font-black">
                  <th className="p-3 rounded-l-xl">Hạng</th>
                  <th className="p-3">Học sinh</th>
                  <th className="p-3">Nhiệm vụ hoàn thành</th>
                  <th className="p-3">Điểm Bài Tập</th>
                  <th className="p-3">Điểm Kiểm Tra</th>
                  <th className="p-3 text-right rounded-r-xl">Tổng Tích Lũy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {leaderboard.map((entry) => (
                  <tr key={entry.student_id} className={`font-bold ${entry.student_id === user?.id ? 'bg-amber-100/80 font-black' : ''}`}>
                    <td className="p-3">
                      {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : entry.rank}
                    </td>
                    <td className="p-3 font-extrabold text-slate-900">{entry.student_name}</td>
                    <td className="p-3">{entry.tasks_completed} nhiệm vụ</td>
                    <td className="p-3">{entry.assignment_score}</td>
                    <td className="p-3">{entry.test_score}</td>
                    <td className="p-3 text-right font-black text-amber-900 text-sm">{entry.total_points} điểm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. HỒ SƠ */}
      {activeMenu === 'profile' && (
        <div className="bg-white p-6 rounded-3xl border-2 border-amber-200 shadow-md max-w-md mx-auto space-y-4">
          <h2 className="text-base font-black text-amber-950">👤 HỒ SƠ HỌC SINH</h2>
          <div className="space-y-2 text-xs font-bold text-slate-800">
            <div>Họ và Tên: <span className="font-extrabold">{user?.full_name}</span></div>
            <div>Email đăng nhập: <span className="font-extrabold">{user?.email}</span></div>
            <div>Mã Học Sinh: <span className="font-extrabold">{user?.student_code || 'HS2026_02'}</span></div>
            <div>Khối Lớp: <span className="font-extrabold text-amber-800">Khối Lớp 2</span></div>
          </div>
        </div>
      )}

    </div>
  );
};
