import { createClient } from '@supabase/supabase-js';
import { 
  UserProfile, ClassItem, ClassMember, Material, LearningMaterial, 
  GameItem, DailyTask, TaskCompletion, Assignment, 
  AssignmentQuestion, AssignmentSubmission, QuestionResponse, 
  StudentProgress, LeaderboardEntry, AIWeaknessSummary 
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pvhpxgczjmzwahidabzy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDMyNjQsImV4cCI6MjEwMjk3OTI2NH0.tRm7IGUDsLl8nu82jl1GOi520eJjNoSiA4eoYnCAXak';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU';
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- AUTH HELPERS ---
export async function getCurrentProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
}

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
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
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as UserProfile[];
}

export async function updateUserStatus(userId: string, status: 'approved' | 'rejected'): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ status })
    .eq('id', userId);

  if (error) throw error;
}

// --- CLASS SERVICES ---
export async function getTeacherClasses(teacherId: string): Promise<ClassItem[]> {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getStudentClasses(studentId: string): Promise<ClassItem[]> {
  const { data, error } = await supabaseAdmin
    .from('class_members')
    .select('class_id, classes (*)')
    .eq('student_id', studentId);

  if (error) throw error;
  return data?.map((item: any) => item.classes).filter(Boolean) || [];
}

export async function createClass(name: string, grade: number = 2, teacherId: string, description?: string): Promise<ClassItem> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const insertPayload: any = { name, grade, code, teacher_id: teacherId };
  if (description) insertPayload.description = description;

  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    if (error.message.includes("Could not find the 'description' column") || (error as any).code === 'PGRST204') {
      delete insertPayload.description;
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('classes')
        .insert([insertPayload])
        .select()
        .single();

      if (fallbackError) throw fallbackError;
      return fallbackData;
    }
    throw error;
  }

  return data;
}

export async function joinClassByCode(code: string, studentId: string): Promise<ClassItem> {
  const cleanCode = code.trim().toUpperCase();
  const { data: cls, error: clsErr } = await supabaseAdmin
    .from('classes')
    .select('*')
    .eq('code', cleanCode)
    .single();

  if (clsErr || !cls) {
    throw new Error('Mã gia nhập Lớp không tồn tại! Vui lòng kiểm tra lại mã từ Giáo viên.');
  }

  // Dùng supabaseAdmin để bypass RLS
  const { error: joinErr } = await supabaseAdmin
    .from('class_members')
    .upsert([{ class_id: cls.id, student_id: studentId }], { onConflict: 'class_id,student_id' });

  if (joinErr && !joinErr.message.includes('unique constraint')) {
    console.warn('joinClassByCode warning:', joinErr.message);
  }

  return cls;
}

export async function getClassMembers(classId: string): Promise<ClassMember[]> {
  const { data, error } = await supabaseAdmin
    .from('class_members')
    .select('*, student:profiles(*)')
    .eq('class_id', classId);

  if (error) throw error;
  return data || [];
}

export async function addStudentToClass(classId: string, studentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('class_members')
    .upsert([{ class_id: classId, student_id: studentId }], { onConflict: 'class_id,student_id' });

  if (error && !error.message.includes('unique constraint')) {
    throw error;
  }
}

// BATCH IMPORT 33+ HỌC SINH 1-CLICK TỪ FILE EXCEL
export async function batchImportStudentsToClass(
  classId: string, 
  studentList: { full_name: string; email: string; phone?: string; student_code?: string }[]
): Promise<number> {
  if (!classId || !studentList || studentList.length === 0) return 0;

  // 1. Chuẩn bị mảng profiles để Batch Upsert qua Service Role Client (bypassing RLS)
  const profilesToUpsert = studentList.map(st => ({
    id: crypto.randomUUID(),
    email: st.email.trim().toLowerCase(),
    full_name: st.full_name,
    role: 'student' as const,
    status: 'approved' as const,
    student_code: st.student_code,
    phone: st.phone || ''
  }));

  // Batch Upsert
  const { error: pErr } = await supabaseAdmin
    .from('profiles')
    .upsert(profilesToUpsert, { onConflict: 'email' });

  if (pErr) console.warn('Admin Profiles Upsert Warning:', pErr.message);

  // 2. Lấy lại tất cả profile IDs theo danh sách email
  const emailList = studentList.map(st => st.email.trim().toLowerCase());
  const { data: createdProfiles, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .in('email', emailList);

  if (fetchErr || !createdProfiles || createdProfiles.length === 0) {
    return 0;
  }

  // Cập nhật lại Họ tên cho khớp chuẩn Tiếng Việt trong file Excel
  for (const p of createdProfiles) {
    const matchedSt = studentList.find(st => st.email.trim().toLowerCase() === p.email.toLowerCase());
    if (matchedSt && matchedSt.full_name && matchedSt.full_name !== p.full_name) {
      await supabaseAdmin
        .from('profiles')
        .update({
          full_name: matchedSt.full_name,
          student_code: matchedSt.student_code,
          phone: matchedSt.phone || ''
        })
        .eq('id', p.id);
    }
  }

  // 3. Batch Insert vào bảng class_members qua Service Role Client (bypassing RLS)
  const memberRows = createdProfiles.map(p => ({
    class_id: classId,
    student_id: p.id
  }));

  const { error: mErr } = await supabaseAdmin
    .from('class_members')
    .upsert(memberRows, { onConflict: 'class_id,student_id' });

  if (mErr) {
    console.warn('Admin Class Members Upsert Warning:', mErr.message);
  }

  return createdProfiles.length;
}

// --- MATERIALS & GAME HUB ---
export async function getMaterials(classId?: string, isPublic = false): Promise<Material[]> {
  let query = supabaseAdmin.from('materials').select('*').order('created_at', { ascending: false });

  if (classId) {
    query = query.or(`class_id.eq.${classId},is_public.eq.true`);
  } else if (isPublic) {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createMaterial(mat: Omit<Material, 'id' | 'created_at'>): Promise<Material> {
  const { data, error } = await supabaseAdmin
    .from('materials')
    .insert([mat])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getLearningMaterials(classId: string): Promise<LearningMaterial[]> {
  const { data, error } = await supabaseAdmin
    .from('learning_materials')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addLearningMaterial(material: Omit<LearningMaterial, 'id' | 'created_at'>): Promise<LearningMaterial> {
  const { data, error } = await supabaseAdmin
    .from('learning_materials')
    .insert([material])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getGames(classId: string): Promise<GameItem[]> {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addGame(game: Omit<GameItem, 'id' | 'created_at'>): Promise<GameItem> {
  const { data, error } = await supabaseAdmin
    .from('games')
    .insert([game])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- DAILY TASKS ---
export async function getDailyTasks(classId: string, studentId?: string): Promise<DailyTask[]> {
  const { data: tasks, error } = await supabaseAdmin
    .from('daily_tasks')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!tasks || tasks.length === 0) return [];

  const taskIds = tasks.map(t => t.id);
  const { data: completions } = await supabaseAdmin
    .from('task_completions')
    .select('task_id, student_id')
    .in('task_id', taskIds);

  const { count: totalStudentsCount } = await supabaseAdmin
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
  const { data, error } = await supabaseAdmin
    .from('daily_tasks')
    .insert([task])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markTaskCompleted(taskId: string, studentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('task_completions')
    .upsert([{ task_id: taskId, student_id: studentId }], { onConflict: 'task_id,student_id' });

  if (error && !error.message.includes('unique constraint')) throw error;
}

export async function getTaskCompletionList(taskId: string): Promise<TaskCompletion[]> {
  const { data, error } = await supabaseAdmin
    .from('task_completions')
    .select('*, student:profiles(*)')
    .eq('task_id', taskId);

  if (error) throw error;
  return data || [];
}

// --- ASSIGNMENTS & QUESTIONS ---
export async function getAssignments(classId: string, isTeacher = false): Promise<Assignment[]> {
  let query = supabaseAdmin
    .from('assignments')
    .select('*, questions:assignment_questions(*), material:materials(*)')
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
  const { data: assignment, error: assignErr } = await supabaseAdmin
    .from('assignments')
    .insert([assignmentData])
    .select()
    .single();

  if (assignErr) throw assignErr;

  if (questions && questions.length > 0) {
    const questionsToInsert = questions.map((q, index) => ({
      ...q,
      assignment_id: assignment.id,
      order_index: index
    }));

    const { data: insertedQuestions, error: qErr } = await supabaseAdmin
      .from('assignment_questions')
      .insert(questionsToInsert)
      .select();

    if (qErr) throw qErr;
    return { ...assignment, questions: insertedQuestions };
  }

  return assignment;
}

export async function finalizeAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('assignments')
    .update({ is_finalized: true })
    .eq('id', assignmentId);

  if (error) throw error;
}

// --- STUDENT PROGRESS & ANALYTICS ---
export async function recordStudentProgress(
  assignmentId: string,
  studentId: string,
  status: 'not_started' | 'in_progress' | 'completed',
  score: number = 0,
  completionTimeSeconds: number = 0
): Promise<StudentProgress> {
  const { data, error } = await supabaseAdmin
    .from('student_progress')
    .upsert({
      assignment_id: assignmentId,
      student_id: studentId,
      status,
      score,
      completion_time_seconds: completionTimeSeconds,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getStudentProgressList(studentId: string): Promise<StudentProgress[]> {
  const { data, error } = await supabaseAdmin
    .from('student_progress')
    .select('*, assignment:assignments(*)')
    .eq('student_id', studentId);

  if (error) throw error;
  return data || [];
}

export async function getClassProgressSummary(classId: string): Promise<StudentProgress[]> {
  const { data, error } = await supabaseAdmin
    .from('student_progress')
    .select('*, student:profiles(*), assignment:assignments(*)')
    .eq('assignment.class_id', classId);

  if (error) throw error;
  return data || [];
}

// --- SUBMISSIONS & QUESTION TIMERS ---
export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  responses: { question_id: string; selected_options: string[]; time_spent_seconds: number; is_correct: boolean }[]
): Promise<AssignmentSubmission> {
  const totalScore = responses.reduce((sum, r) => sum + (r.is_correct ? 10 : 0), 0);
  const totalTime = responses.reduce((sum, r) => sum + r.time_spent_seconds, 0);

  // Tạo submission
  const { data: submission, error: subErr } = await supabaseAdmin
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

  // Ghi nhận tiến độ vào student_progress
  await recordStudentProgress(assignmentId, studentId, 'completed', totalScore, totalTime);

  // Tạo từng question response
  const responsesToInsert = responses.map(r => ({
    submission_id: submission.id,
    question_id: r.question_id,
    student_id: studentId,
    selected_options: r.selected_options,
    time_spent_seconds: r.time_spent_seconds,
    is_correct: r.is_correct
  }));

  const { error: respErr } = await supabaseAdmin
    .from('question_responses')
    .insert(responsesToInsert);

  if (respErr) throw respErr;

  return submission;
}

export async function getStudentSubmissions(studentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabaseAdmin
    .from('assignment_submissions')
    .select('*, assignment:assignments(*), responses:question_responses(*)')
    .eq('student_id', studentId);

  if (error) throw error;
  return data || [];
}

export async function getClassSubmissionsForTeacher(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin
    .from('assignment_submissions')
    .update({
      score,
      teacher_remark: teacherRemark,
      status: 'finalized_by_teacher'
    })
    .eq('id', submissionId);

  if (error) throw error;
}

// --- LEADERBOARD ---
export async function getClassLeaderboard(classId: string): Promise<LeaderboardEntry[]> {
  const members = await getClassMembers(classId);
  if (!members || members.length === 0) return [];

  const studentIds = members.map(m => m.student_id);

  const { data: completions } = await supabaseAdmin
    .from('task_completions')
    .select('student_id')
    .in('student_id', studentIds);

  const { data: submissions } = await supabaseAdmin
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

  leaderboard.sort((a, b) => b.total_points - a.total_points);
  leaderboard.forEach((entry, idx) => entry.rank = idx + 1);

  return leaderboard;
}

// --- FILE UPLOAD TO SUPABASE STORAGE ---
export async function uploadFileToStorage(bucket: 'materials' | 'question-images' | 'html5-games', file: File): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) {
      console.warn('Storage upload warning, fallback to local URL:', uploadError.message);
      return URL.createObjectURL(file);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('File upload exception:', err);
    return URL.createObjectURL(file);
  }
}
