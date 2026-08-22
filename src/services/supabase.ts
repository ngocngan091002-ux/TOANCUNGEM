import { createClient } from '@supabase/supabase-js';
import { 
  UserProfile, ClassItem, ClassMember, LearningMaterial, 
  GameItem, DailyTask, TaskCompletion, Assignment, 
  AssignmentQuestion, AssignmentSubmission, QuestionResponse, 
  LeaderboardEntry, AIWeaknessSummary 
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pvhpxgczjmzwahidabzy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDMyNjQsImV4cCI6MjEwMjk3OTI2NH0.tRm7IGUDsLl8nu82jl1GOi520eJjNoSiA4eoYnCAXak';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- AUTH HELPERS ---
export async function getCurrentProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Profile fetch error:', error.message);
      return null;
    }
    return data as UserProfile;
  } catch (err) {
    console.error('getCurrentProfile Exception:', err);
    return null;
  }
}

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase());

    if (error) return false;
    return (data && data.length > 0);
  } catch {
    return false;
  }
}

// --- ADMIN SERVICES ---
export async function getAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as UserProfile[];
}

export async function updateUserStatus(userId: string, status: 'approved' | 'rejected'): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId);

  if (error) throw error;
}

// --- CLASS SERVICES ---
export async function getTeacherClasses(teacherId: string): Promise<ClassItem[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getStudentClasses(studentId: string): Promise<ClassItem[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('class_id, classes (*)')
    .eq('student_id', studentId);

  if (error) throw error;
  return data?.map((item: any) => item.classes).filter(Boolean) || [];
}

export async function createClass(name: string, grade: number, teacherId: string): Promise<ClassItem> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from('classes')
    .insert([{ name, grade, code, teacher_id: teacherId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getClassMembers(classId: string): Promise<ClassMember[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('*, student:profiles(*)')
    .eq('class_id', classId);

  if (error) throw error;
  return data || [];
}

export async function addStudentToClass(classId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('class_members')
    .insert([{ class_id: classId, student_id: studentId }]);

  if (error && !error.message.includes('unique constraint')) {
    throw error;
  }
}

// --- LEARNING MATERIALS & GAMES ---
export async function getLearningMaterials(classId: string): Promise<LearningMaterial[]> {
  const { data, error } = await supabase
    .from('learning_materials')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addLearningMaterial(material: Omit<LearningMaterial, 'id' | 'created_at'>): Promise<LearningMaterial> {
  const { data, error } = await supabase
    .from('learning_materials')
    .insert([material])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getGames(classId: string): Promise<GameItem[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addGame(game: Omit<GameItem, 'id' | 'created_at'>): Promise<GameItem> {
  const { data, error } = await supabase
    .from('games')
    .insert([game])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- DAILY TASKS ---
export async function getDailyTasks(classId: string, studentId?: string): Promise<DailyTask[]> {
  const { data: tasks, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  if (!tasks || tasks.length === 0) return [];

  // Lấy số lượng hoàn thành cho mỗi nhiệm vụ
  const taskIds = tasks.map(t => t.id);
  const { data: completions } = await supabase
    .from('task_completions')
    .select('task_id, student_id')
    .in('task_id', taskIds);

  const { count: totalStudentsCount } = await supabase
    .from('class_members')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId);

  return tasks.map(t => {
    const taskCompletions = completions?.filter(c => c.task_id === t.id) || [];
    const isCompleted = studentId ? taskCompletions.some(c => c.student_id === studentId) : false;

    return {
      ...t,
      completed_count: taskCompletions.length,
      total_students: totalStudentsCount || 0,
      is_completed: isCompleted
    };
  });
}

export async function createDailyTask(task: Omit<DailyTask, 'id' | 'created_at'>): Promise<DailyTask> {
  const { data, error } = await supabase
    .from('daily_tasks')
    .insert([task])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markTaskCompleted(taskId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('task_completions')
    .insert([{ task_id: taskId, student_id: studentId }]);

  if (error && !error.message.includes('unique constraint')) throw error;
}

export async function getTaskCompletionList(taskId: string): Promise<TaskCompletion[]> {
  const { data, error } = await supabase
    .from('task_completions')
    .select('*, student:profiles(*)')
    .eq('task_id', taskId);

  if (error) throw error;
  return data || [];
}

// --- ASSIGNMENTS & QUESTIONS ---
export async function getAssignments(classId: string, isTeacher = false): Promise<Assignment[]> {
  let query = supabase
    .from('assignments')
    .select('*, questions:assignment_questions(*)')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (!isTeacher) {
    query = query.eq('is_finalized', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createAssignmentWithQuestions(
  assignmentData: Omit<Assignment, 'id' | 'created_at'>,
  questions: Omit<AssignmentQuestion, 'id' | 'assignment_id'>[]
): Promise<Assignment> {
  const { data: assignment, error: assignErr } = await supabase
    .from('assignments')
    .insert([assignmentData])
    .select()
    .single();

  if (assignErr) throw assignErr;

  const questionsToInsert = questions.map((q, index) => ({
    ...q,
    assignment_id: assignment.id,
    order_index: index
  }));

  const { data: insertedQuestions, error: qErr } = await supabase
    .from('assignment_questions')
    .insert(questionsToInsert)
    .select();

  if (qErr) throw qErr;

  return { ...assignment, questions: insertedQuestions };
}

export async function finalizeAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('assignments')
    .update({ is_finalized: true })
    .eq('id', assignmentId);

  if (error) throw error;
}

// --- SUBMISSIONS & QUESTION TIMERS ---
export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  responses: { question_id: string; selected_options: string[]; time_spent_seconds: number; is_correct: boolean }[]
): Promise<AssignmentSubmission> {
  const totalScore = responses.reduce((sum, r) => sum + (r.is_correct ? 10 : 0), 0);

  // Tạo submission
  const { data: submission, error: subErr } = await supabase
    .from('assignment_submissions')
    .insert([{
      assignment_id: assignmentId,
      student_id: studentId,
      score: totalScore,
      status: 'submitted'
    }])
    .select()
    .single();

  if (subErr) throw subErr;

  // Tạo từng question response kèm bộ đếm thời gian
  const responsesToInsert = responses.map(r => ({
    submission_id: submission.id,
    question_id: r.question_id,
    student_id: studentId,
    selected_options: r.selected_options,
    time_spent_seconds: r.time_spent_seconds,
    is_correct: r.is_correct
  }));

  const { error: respErr } = await supabase
    .from('question_responses')
    .insert(responsesToInsert);

  if (respErr) throw respErr;

  return submission;
}

export async function getStudentSubmissions(studentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*, assignment:assignments(*), responses:question_responses(*)')
    .eq('student_id', studentId);

  if (error) throw error;
  return data || [];
}

export async function getClassSubmissionsForTeacher(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*, student:profiles(*), responses:question_responses(*)')
    .eq('assignment_id', assignmentId);

  if (error) throw error;
  return data || [];
}

export async function updateTeacherGrading(
  submissionId: string,
  score: number,
  teacherRemark: string
): Promise<void> {
  const { error } = await supabase
    .from('assignment_submissions')
    .update({
      score,
      teacher_remark: teacherRemark,
      status: 'finalized_by_teacher'
    })
    .eq('id', submissionId);

  if (error) throw error;
}

export async function updateAISuggestedGrading(
  submissionId: string,
  aiScore: number,
  aiRemark: string
): Promise<void> {
  const { error } = await supabase
    .from('assignment_submissions')
    .update({
      ai_suggested_score: aiScore,
      ai_suggested_remark: aiRemark,
      status: 'graded_by_ai'
    })
    .eq('id', submissionId);

  if (error) throw error;
}

// --- LEADERBOARD & ANALYTICS ---
export async function getClassLeaderboard(classId: string): Promise<LeaderboardEntry[]> {
  const members = await getClassMembers(classId);
  if (!members || members.length === 0) return [];

  const studentIds = members.map(m => m.student_id);

  // Lấy tổng nhiệm vụ hoàn thành
  const { data: completions } = await supabase
    .from('task_completions')
    .select('student_id')
    .in('student_id', studentIds);

  // Lấy điểm các bài tập & bài kiểm tra
  const { data: submissions } = await supabase
    .from('assignment_submissions')
    .select('student_id, score, status, assignment:assignments(type)')
    .in('student_id', studentIds)
    .eq('status', 'finalized_by_teacher');

  const leaderboard: LeaderboardEntry[] = members.map(m => {
    const student = m.student;
    const studentCompletions = completions?.filter(c => c.student_id === m.student_id).length || 0;
    
    const studentSubs = submissions?.filter(s => s.student_id === m.student_id) || [];
    const exerciseSubs = studentSubs.filter(s => (s.assignment as any)?.type === 'exercise');
    const testSubs = studentSubs.filter(s => (s.assignment as any)?.type === 'weekly_test');

    const avgExercise = exerciseSubs.length > 0 ? exerciseSubs.reduce((a, b) => a + Number(b.score), 0) / exerciseSubs.length : 0;
    const avgTest = testSubs.length > 0 ? testSubs.reduce((a, b) => a + Number(b.score), 0) / testSubs.length : 0;

    const totalPoints = (studentCompletions * 10) + Math.round(avgExercise) + Math.round(avgTest * 1.5);

    return {
      student_id: m.student_id,
      student_name: student?.full_name || 'Học sinh',
      student_code: student?.student_code,
      avatar_url: student?.avatar_url,
      tasks_completed: studentCompletions,
      assignment_score: Math.round(avgExercise * 10) / 10,
      test_score: Math.round(avgTest * 10) / 10,
      total_points: totalPoints,
      rank: 0
    };
  });

  // Sắp xếp theo tổng điểm giảm dần
  leaderboard.sort((a, b) => b.total_points - a.total_points);
  leaderboard.forEach((entry, idx) => entry.rank = idx + 1);

  return leaderboard;
}

// --- FILE UPLOAD TO SUPABASE STORAGE ---
export async function uploadFileToStorage(bucket: 'materials' | 'question-images', file: File): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      console.warn('Storage upload warning, using Object URL fallback:', uploadError.message);
      return URL.createObjectURL(file);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('File upload exception:', err);
    return URL.createObjectURL(file);
  }
}
