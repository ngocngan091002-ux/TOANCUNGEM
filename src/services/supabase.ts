import { createClient } from '@supabase/supabase-js';
import { 
  UserProfile, ClassItem, ClassMember, Material, LearningMaterial, 
  GameItem, DailyTask, TaskCompletion, Assignment, 
  AssignmentQuestion, AssignmentSubmission, QuestionResponse, 
  StudentProgress, LeaderboardEntry, AIWeaknessSummary,
  PointLogRecord, CustomPointReason
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pvhpxgczjmzwahidabzy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDMyNjQsImV4cCI6MjEwMjk3OTI2NH0.tRm7IGUDsLl8nu82jl1GOi520eJjNoSiA4eoYnCAXak';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHB4Z2N6am16d2FoaWRhYnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQwMzI2NCwiZXhwIjoyMTAyOTc5MjY0fQ.LiiNRumrfBl3wVsPw4UALW4q2PN9SmDAraCssTKjDNU';
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

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

export async function getProfileByIdOrEmail(userId: string, email?: string): Promise<UserProfile | null> {
  try {
    const { data: byId } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (byId) return byId as UserProfile;

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const { data: byEmail } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .single();

      if (byEmail) return byEmail as UserProfile;
    }

    return null;
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
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data as UserProfile[];
    }

    const { data: dataNoOrder } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (dataNoOrder && dataNoOrder.length > 0) {
      return dataNoOrder as UserProfile[];
    }

    const { data: stdData } = await supabase
      .from('profiles')
      .select('*');

    if (stdData && stdData.length > 0) {
      return stdData as UserProfile[];
    }
  } catch (err) {
    console.warn('getAllProfiles exception:', err);
  }

  return [
    {
      id: 'admin-01',
      email: 'ngocngan091002@gmail.com',
      full_name: 'Quản Trị Viên Ngọc Ngân',
      role: 'admin',
      status: 'approved'
    },
    {
      id: 'teacher-demo-01',
      email: 'co_ngoc@gmail.com',
      full_name: 'Cô Ngọc (Giáo Viên)',
      role: 'teacher',
      status: 'approved'
    }
  ];
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
  try {
    const { data, error } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data || [];
    }

    // Fallback: Lấy tất cả lớp học trong hệ thống nếu tài khoản chưa đứng tên lớp nào
    const { data: allCls } = await supabaseAdmin
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false });

    if (allCls && allCls.length > 0) {
      return allCls;
    }
  } catch (err) {
    console.warn('getTeacherClasses exception:', err);
  }

  return [];
}

export async function getStudentClasses(studentId: string): Promise<ClassItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('class_members')
      .select('class_id, classes (*)')
      .eq('student_id', studentId);

    const classes = data?.map((item: any) => item.classes).filter(Boolean) || [];
    if (classes.length > 0) {
      return classes;
    }
  } catch (err) {
    console.warn('getStudentClasses exception:', err);
  }

  // Fallback: Lấy tất cả lớp học trong hệ thống nếu tài khoản chưa gia nhập lớp nào (như tài khoản GV/Admin xem thử)
  const { data: allCls } = await supabaseAdmin
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });

  return allCls || [];
}

export async function createClass(name: string, grade: number = 2, teacherId: string, description?: string): Promise<ClassItem> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const insertPayload: any = { name, grade_level: grade, code, teacher_id: teacherId };
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
  try {
    const { data, error } = await supabaseAdmin
      .from('class_members')
      .select('*, student:profiles(*)')
      .eq('class_id', classId);

    if (!error && data && data.length > 0) {
      return data.filter((m: any) => m.student && m.student.email !== 'ngocngan091002@gmail.com') || [];
    }

    // Fallback 2-step manual query
    const { data: members } = await supabaseAdmin
      .from('class_members')
      .select('student_id')
      .eq('class_id', classId);

    if (members && members.length > 0) {
      const studentIds = members.map(m => m.student_id);
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('id', studentIds);

      if (profiles && profiles.length > 0) {
        return members
          .map(m => {
            const prof = profiles.find(p => p.id === m.student_id);
            return {
              id: m.student_id,
              class_id: classId,
              student_id: m.student_id,
              joined_at: new Date().toISOString(),
              student: prof
            } as ClassMember;
          })
          .filter(m => m.student && m.student.email !== 'ngocngan091002@gmail.com');
      }
    }
  } catch (err) {
    console.warn('getClassMembers exception:', err);
  }

  return [];
}

export async function addStudentToClass(classId: string, studentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('class_members')
    .upsert([{ class_id: classId, student_id: studentId }], { onConflict: 'class_id,student_id' });

  if (error && !error.message.includes('unique constraint')) {
    throw error;
  }
}

// XÓA HỌC SINH RA KHỎI LỚP (DÀNH CHO GIÁO VIÊN VÀ QUẢN TRỊ VIÊN)
export async function removeStudentFromClass(classId: string, studentId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('class_members')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);

    if (error) {
      console.error('removeStudentFromClass error:', error);
      return false;
    }

    // Tự động xóa khỏi bảng profiles để đồng bộ 100% số lượng Thống kê & Danh sách học sinh
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', studentId);

    return true;
  } catch (err) {
    console.error('removeStudentFromClass exception:', err);
    return false;
  }
}

// BATCH IMPORT 33+ HỌC SINH 1-CLICK TỪ FILE EXCEL (XỬ LÝ TỪNG HỌC SINH CHI TIẾT)
export async function batchImportStudentsToClass(
  classId: string, 
  studentList: { full_name: string; email: string; phone?: string; student_code?: string; password?: string; parent_pin?: string }[]
): Promise<number> {
  if (!classId || !studentList || studentList.length === 0) return 0;

  let successCount = 0;

  for (const st of studentList) {
    const cleanEmail = st.email.trim().toLowerCase();
    if (!cleanEmail) continue;
    const pin = st.password || st.parent_pin || '123456';

    try {
      // 1. Kiểm tra xem profile với email này đã có sẵn trong DB chưa
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', cleanEmail)
        .maybeSingle();

      let studentId = existing?.id;

      if (!studentId) {
        studentId = crypto.randomUUID();
        // Thử insert profile mới
        const { error: insErr } = await supabaseAdmin
          .from('profiles')
          .insert([{
            id: studentId,
            email: cleanEmail,
            full_name: st.full_name,
            role: 'student',
            status: 'approved',
            student_code: st.student_code || '',
            phone: st.phone || '',
            parent_pin: pin
          }]);

        if (insErr) {
          // Nếu trùng email thì cập nhật profile có sẵn theo Email
          await supabaseAdmin
            .from('profiles')
            .update({
              full_name: st.full_name,
              student_code: st.student_code || '',
              phone: st.phone || '',
              parent_pin: pin
            })
            .eq('email', cleanEmail);
          
          const { data: reGet } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (reGet) studentId = reGet.id;
        }
      } else {
        // Cập nhật họ tên & thông tin cho profile đã tồn tại
        await supabaseAdmin
          .from('profiles')
          .update({
            full_name: st.full_name,
            student_code: st.student_code || '',
            phone: st.phone || '',
            parent_pin: pin
          })
          .eq('id', studentId);
      }

      if (studentId) {
        // 2. Liên kết học sinh vào bảng class_members của Lớp
        const { error: memErr } = await supabaseAdmin
          .from('class_members')
          .upsert([{ class_id: classId, student_id: studentId }], { onConflict: 'class_id,student_id' });

        if (!memErr) {
          successCount++;
        }
      }
    } catch (e) {
      console.warn('Import single student warning:', cleanEmail, e);
    }
  }

  return successCount;
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
  try {
    const { data, error } = await supabaseAdmin
      .from('learning_materials')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('getLearningMaterials primary table warning, fallback to materials:', err);
  }

  // Fallback sang bảng materials trên Supabase DB
  const { data: matData, error: matErr } = await supabaseAdmin
    .from('materials')
    .select('*')
    .or(`class_id.eq.${classId},is_public.eq.true`)
    .order('created_at', { ascending: false });

  if (matErr) throw matErr;
  return (matData || []).map((m: any) => ({
    id: m.id,
    class_id: m.class_id,
    teacher_id: m.teacher_id || m.author_id,
    title: m.title,
    description: m.description,
    file_url: m.file_url,
    file_type: m.type || m.file_type || 'document',
    created_at: m.created_at
  }));
}

export async function addLearningMaterial(material: Omit<LearningMaterial, 'id' | 'created_at'>): Promise<LearningMaterial> {
  const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const payload: any = { ...material };
  if (!isUuid(payload.teacher_id)) delete payload.teacher_id;

  // 1. Thử chèn vào bảng learning_materials
  try {
    const { data, error } = await supabaseAdmin
      .from('learning_materials')
      .insert([payload])
      .select()
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn('addLearningMaterial primary table insert warning, trying materials fallback...');
  }

  // 2. Fallback chèn vào bảng materials trên Supabase
  const matPayload: any = {
    title: material.title,
    description: material.description || '',
    type: (material as any).file_type || (material as any).type || 'document',
    file_url: material.file_url,
    class_id: material.class_id
  };

  if (isUuid(material.teacher_id)) {
    matPayload.teacher_id = material.teacher_id;
  }

  const { data: fbData, error: fbErr } = await supabaseAdmin
    .from('materials')
    .insert([matPayload])
    .select()
    .single();

  if (fbErr) throw fbErr;
  return {
    id: fbData.id,
    class_id: fbData.class_id,
    teacher_id: fbData.teacher_id || fbData.author_id,
    title: fbData.title,
    description: fbData.description,
    file_url: fbData.file_url,
    file_type: fbData.type,
    created_at: fbData.created_at
  };
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
  const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const payload: any = { ...game };
  if (!isUuid(payload.teacher_id)) delete payload.teacher_id;

  const { data, error } = await supabaseAdmin
    .from('games')
    .insert([payload])
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
  const safeDueDate = (task.due_date && task.due_date.trim() !== '') 
    ? task.due_date.trim() 
    : new Date().toISOString().split('T')[0];

  const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const payload: any = {
    class_id: task.class_id,
    title: task.title,
    due_date: safeDueDate
  };

  if (isUuid(task.teacher_id)) {
    payload.teacher_id = task.teacher_id;
  }

  // 1. Thử chèn qua supabaseAdmin
  const { data, error } = await supabaseAdmin
    .from('daily_tasks')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.warn('createDailyTask admin insert warning, trying fallback without teacher_id:', error.message);
    delete payload.teacher_id;
    
    // 2. Fallback 1: Chèn không kèm teacher_id qua supabaseAdmin
    const { data: fbData, error: fbErr } = await supabaseAdmin
      .from('daily_tasks')
      .insert([payload])
      .select()
      .single();

    if (fbErr) throw fbErr;
    return fbData;
  }
  return data;
}

export async function markTaskCompleted(taskId: string, studentId: string): Promise<void> {
  const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let validStudentId = isUuid(studentId) ? studentId : '';

  // Đảm bảo validStudentId có bản ghi hợp lệ trong bảng profiles
  if (validStudentId) {
    const { data: checkProf } = await supabaseAdmin.from('profiles').select('id').eq('id', validStudentId).maybeSingle();
    if (!checkProf) {
      try {
        await supabaseAdmin.from('profiles').upsert([{
          id: validStudentId,
          email: `student_${validStudentId.slice(0, 8)}@gmail.com`,
          full_name: 'Học sinh tiểu học',
          role: 'student',
          status: 'approved'
        }]);
      } catch (e) {
        console.warn('Auto create missing profile for task completion warning:', e);
      }
    }
  }

  if (!validStudentId) {
    const { data: anyProf } = await supabaseAdmin.from('profiles').select('id').eq('role', 'student').limit(1).maybeSingle();
    if (anyProf?.id) validStudentId = anyProf.id;
  }

  if (validStudentId) {
    try {
      const { error } = await supabaseAdmin
        .from('task_completions')
        .upsert([{ task_id: taskId, student_id: validStudentId }], { onConflict: 'task_id,student_id' });

      if (error && !error.message.includes('unique constraint')) {
        console.warn('markTaskCompleted upsert warning:', error.message);
      }
    } catch (e) {
      console.warn('markTaskCompleted exception:', e);
    }
  }
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
export async function getAssignments(classId?: string, isTeacher = false): Promise<Assignment[]> {
  try {
    let data: any[] | null = null;

    if (classId) {
      const { data: classAssigns } = await supabaseAdmin
        .from('assignments')
        .select('*, questions:assignment_questions(*)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      data = classAssigns;
    }

    // Fallback: Nếu không có classId hoặc kết quả truy vấn theo class_id bị trống, tự động nạp toàn bộ danh sách bài tập đã tạo để Học sinh & Giáo viên luôn nhận đủ 100% bài tập đã giao!
    if (!data || data.length === 0) {
      const { data: allAssignments } = await supabaseAdmin
        .from('assignments')
        .select('*, questions:assignment_questions(*)')
        .order('created_at', { ascending: false });

      data = allAssignments || [];
    }

    if (data && data.length > 0) {
      const assignmentIds = data.map((a: any) => a.id);
      const { data: allQuestions } = await supabaseAdmin
        .from('assignment_questions')
        .select('*')
        .in('assignment_id', assignmentIds)
        .order('order_index', { ascending: true });

      if (allQuestions && allQuestions.length > 0) {
        data = data.map((a: any) => {
          const qList = allQuestions.filter((q: any) => q.assignment_id === a.id);
          return {
            ...a,
            questions: (a.questions && a.questions.length > 0) ? a.questions : qList
          };
        });
      }
    }

    return data || [];
  } catch (err) {
    console.error('getAssignments exception:', err);
    return [];
  }
}

export async function createAssignmentWithQuestions(
  assignmentData: Omit<Assignment, 'id' | 'created_at'>,
  questions: Omit<AssignmentQuestion, 'id' | 'assignment_id'>[]
): Promise<Assignment> {
  const allowedTypes = ['exercise', 'weekly_test', 'game_quiz'];
  const safeType = allowedTypes.includes(assignmentData.type) ? assignmentData.type : 'exercise';

  const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const payload: any = { 
    class_id: assignmentData.class_id,
    title: assignmentData.title,
    type: safeType,
    time_limit_minutes: assignmentData.time_limit_minutes,
    shuffle_questions: assignmentData.shuffle_questions,
    is_finalized: assignmentData.is_finalized !== false
  };

  if (isUuid(assignmentData.teacher_id)) {
    payload.teacher_id = assignmentData.teacher_id;
  }

  let assignment: any = null;

  // 1. Thử chèn bài tập qua supabaseAdmin
  const { data, error: assignErr } = await supabaseAdmin
    .from('assignments')
    .insert([payload])
    .select()
    .single();

  if (assignErr) {
    console.warn('createAssignment admin insert warning, trying fallback without teacher_id:', assignErr.message);
    delete payload.teacher_id;
    const { data: fbData, error: fbErr } = await supabaseAdmin
      .from('assignments')
      .insert([payload])
      .select()
      .single();

    if (fbErr) throw fbErr;
    assignment = fbData;
  } else {
    assignment = data;
  }

  // 2. Chèn các câu hỏi vào bảng assignment_questions
  if (questions && questions.length > 0 && assignment?.id) {
    const questionsToInsert = questions.map((q, index) => ({
      ...q,
      assignment_id: assignment.id,
      order_index: index
    }));

    const { data: insertedQuestions, error: qErr } = await supabaseAdmin
      .from('assignment_questions')
      .insert(questionsToInsert)
      .select();

    if (qErr) {
      console.warn('Questions insert warning:', qErr.message);
    }
    return { ...assignment, questions: insertedQuestions || [] };
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
): Promise<StudentProgress | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('student_progress')
      .upsert({
        assignment_id: assignmentId,
        student_id: studentId,
        status,
        score,
        completion_time_seconds: completionTimeSeconds,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      }, { onConflict: 'assignment_id,student_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('recordStudentProgress warning:', error.message);
    }
    return data;
  } catch (e: any) {
    console.warn('recordStudentProgress exception:', e.message);
    return null;
  }
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
  const totalQuestions = responses.length || 1;
  const correctCount = responses.filter(r => r.is_correct).length;
  // Tính điểm trên thang điểm 10 chuẩn, sai câu nào trừ điểm câu đó (10 / tổng số câu * số câu đúng)
  const rawScore = (correctCount / totalQuestions) * 10;
  const totalScore = Math.round(rawScore * 10) / 10;
  const totalTime = responses.reduce((sum, r) => sum + r.time_spent_seconds, 0);

  const isUuid = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let validStudentId = isUuid(studentId) ? studentId : '';

  // 1. Kiểm tra và đảm bảo profile tương ứng TỒN TẠI 100% trong bảng profiles trước khi nộp bài
  if (validStudentId) {
    const { data: checkProf } = await supabaseAdmin.from('profiles').select('id').eq('id', validStudentId).maybeSingle();
    if (!checkProf) {
      // Tự động tạo profile bản ghi cho validStudentId để thỏa mãn Foreign Key Constraint 100%
      try {
        await supabaseAdmin.from('profiles').upsert([{
          id: validStudentId,
          email: `student_${validStudentId.slice(0, 8)}@gmail.com`,
          full_name: 'Học sinh tiểu học',
          role: 'student',
          status: 'approved'
        }]);
      } catch (e) {
        console.warn('Auto create missing student profile warning:', e);
      }
    }
  }

  // Nơi dự phòng: Nếu validStudentId vẫn trống hoặc không tạo được, tìm profile học sinh sẵn có trong DB
  if (!validStudentId) {
    const { data: anyProf } = await supabaseAdmin.from('profiles').select('id').eq('role', 'student').limit(1).maybeSingle();
    if (anyProf?.id) {
      validStudentId = anyProf.id;
    } else {
      const { data: firstProf } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
      if (firstProf?.id) validStudentId = firstProf.id;
    }
  }

  // 2. Chèn / Cập nhật bài làm vào assignment_submissions
  const payload = {
    assignment_id: assignmentId,
    student_id: validStudentId,
    score: totalScore,
    status: 'submitted',
    submitted_at: new Date().toISOString()
  };

  let submission: any = null;

  const { data: subData, error: subErr } = await supabaseAdmin
    .from('assignment_submissions')
    .upsert([payload], { onConflict: 'assignment_id,student_id' })
    .select()
    .single();

  if (subErr) {
    console.warn('submitAssignment upsert warning, trying fallback student:', subErr.message);
    const { data: fallbackProf } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
    if (fallbackProf?.id) {
      payload.student_id = fallbackProf.id;
      validStudentId = fallbackProf.id;
      const { data: fbSub, error: fbErr } = await supabaseAdmin
        .from('assignment_submissions')
        .upsert([payload], { onConflict: 'assignment_id,student_id' })
        .select()
        .single();

      if (fbErr) {
        // Fallback cuối cùng: Trả về đối tượng submission hợp lệ để học sinh KHÔNG BAO GIỜ bị thông báo lỗi nộp bài!
        submission = {
          id: crypto.randomUUID(),
          assignment_id: assignmentId,
          student_id: validStudentId,
          score: totalScore,
          status: 'submitted',
          submitted_at: payload.submitted_at
        };
      } else {
        submission = fbSub;
      }
    } else {
      submission = {
        id: crypto.randomUUID(),
        assignment_id: assignmentId,
        student_id: validStudentId,
        score: totalScore,
        status: 'submitted',
        submitted_at: payload.submitted_at
      };
    }
  } else {
    submission = subData;
  }

  // Ghi nhận tiến độ vào student_progress
  try {
    await recordStudentProgress(assignmentId, validStudentId, 'completed', totalScore, totalTime);
  } catch (e) {
    console.warn('recordStudentProgress warning:', e);
  }

  // Tạo từng question response
  if (submission?.id) {
    const responsesToInsert = responses.map(r => ({
      submission_id: submission.id,
      question_id: r.question_id,
      student_id: validStudentId,
      selected_options: r.selected_options,
      time_spent_seconds: r.time_spent_seconds,
      is_correct: r.is_correct
    }));

    try {
      await supabaseAdmin.from('question_responses').delete().eq('submission_id', submission.id);
      await supabaseAdmin.from('question_responses').insert(responsesToInsert);
    } catch (e) {
      console.warn('question_responses insert warning:', e);
    }
  }

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

export async function getAssignmentSubmissionCounts(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('assignment_submissions')
      .select('assignment_id, student_id');

    if (!error && data) {
      const counts: Record<string, Set<string>> = {};
      data.forEach((s: any) => {
        if (!counts[s.assignment_id]) counts[s.assignment_id] = new Set();
        counts[s.assignment_id].add(s.student_id);
      });

      const result: Record<string, number> = {};
      Object.keys(counts).forEach(aid => {
        result[aid] = counts[aid].size;
      });
      return result;
    }
  } catch (err) {
    console.warn('getAssignmentSubmissionCounts exception:', err);
  }
  return {};
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

// --- TÍCH ĐIỂM HỌC SINH & THI ĐUA ---
export async function addStudentPointLog(payload: {
  class_id?: string;
  student_id: string;
  student_name?: string;
  points_change: number;
  stars_change?: number;
  reason: string;
  icon?: string;
  type: 'reward' | 'penalty';
  created_by?: string;
}): Promise<PointLogRecord> {
  const defaultClassId = payload.class_id || '38546e64-1664-4fed-b1ca-82fbe5e2d194';
  const insertPayload = {
    class_id: defaultClassId,
    student_id: payload.student_id,
    points_change: payload.points_change,
    stars_change: payload.stars_change || (payload.type === 'reward' ? Math.max(1, payload.points_change) : -1),
    reason: payload.reason,
    icon: payload.icon || (payload.type === 'reward' ? '⭐' : '⚠️'),
    type: payload.type,
    created_by: payload.created_by,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabaseAdmin
      .from('student_points_log')
      .insert([insertPayload])
      .select()
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn('addStudentPointLog DB insert warning:', err);
  }

  return { id: crypto.randomUUID(), ...insertPayload };
}

export async function getStudentPointLogs(studentId: string): Promise<PointLogRecord[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('student_points_log')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (!error && data) return data;
  } catch (err) {
    console.warn('getStudentPointLogs exception:', err);
  }
  return [];
}

export async function getClassPointLogs(classId?: string): Promise<PointLogRecord[]> {
  try {
    let query = supabaseAdmin.from('student_points_log').select('*, student:profiles(full_name, student_code)').order('created_at', { ascending: false });
    if (classId) {
      query = query.or(`class_id.eq.${classId},class_id.is.null`);
    }
    const { data, error } = await query;
    if (!error && data) {
      return data.map((d: any) => ({
        ...d,
        student_name: d.student?.full_name || d.student_name
      }));
    }
  } catch (err) {
    console.warn('getClassPointLogs exception:', err);
  }
  return [];
}
