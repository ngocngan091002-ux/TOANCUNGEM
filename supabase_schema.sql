-- ========================================================
-- DATABASE SCHEMA: TOÁN CÙNG EM & EDTECH SYSTEM (PRODUCTION READY)
-- Supabase PostgreSQL Setup File
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BẢNG PROFILES (NGƯỜI DÙNG & PHÂN QUYỀN RBAC)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    student_code TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BẢNG LỚP HỌC (CLASSES)
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    grade INT DEFAULT 2,
    code TEXT UNIQUE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BẢNG THÀNH VIÊN LỚP (CLASS MEMBERS)
CREATE TABLE IF NOT EXISTS public.class_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (class_id, student_id)
);

-- 4. BẢNG KHO HỌC LIỆU & GAME TƯƠNG TÁC (MATERIALS)
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('document', 'video', 'game_iframe', 'game_html5')),
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. BẢNG GIAO BÀI TẬP / GAME CHO LỚP (ASSIGNMENTS)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
    type TEXT DEFAULT 'exercise' CHECK (type IN ('exercise', 'weekly_test', 'game_quiz')),
    is_finalized BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. BẢNG THEO DÕI TIẾN ĐỘ & ĐIỂM SỐ HỌC SINH (STUDENT PROGRESS)
CREATE TABLE IF NOT EXISTS public.student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    score NUMERIC DEFAULT 0,
    completion_time_seconds INT DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (assignment_id, student_id)
);

-- 7. BẢNG CÂU HỎI BÀI TẬP TRẮC NGHIỆM
CREATE TABLE IF NOT EXISTS public.assignment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    options JSONB NOT NULL,
    correct_answers JSONB NOT NULL,
    points NUMERIC DEFAULT 10,
    order_index INT DEFAULT 0
);

-- 8. BẢNG BÀI NỘP CỦA HỌC SINH
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    score NUMERIC DEFAULT 0,
    ai_suggested_score NUMERIC,
    ai_suggested_remark TEXT,
    teacher_remark TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded_by_ai', 'finalized_by_teacher')),
    UNIQUE (assignment_id, student_id)
);

-- 9. BẢNG BỘ ĐẾM THỜI GIAN THEO TỪNG CÂU HỎI
CREATE TABLE IF NOT EXISTS public.question_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.assignment_questions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    selected_options JSONB NOT NULL,
    time_spent_seconds INT NOT NULL DEFAULT 0,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. BẢNG NHIỆM VỤ HÀNG NGÀY & HOÀN THÀNH
CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (task_id, student_id)
);

-- 11. INDEXES TỐI ƯU HIỆU NĂNG QUERY
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_members_student ON public.class_members(student_id);
CREATE INDEX IF NOT EXISTS idx_materials_author ON public.materials(author_id);
CREATE INDEX IF NOT EXISTS idx_materials_class ON public.materials(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_student ON public.student_progress(student_id);

-- ========================================================
-- TRIGGER TỰ ĐỘNG KHỞI TẠO PROFILES KHI SIGNUP AUTH
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    assigned_status TEXT;
    user_full_name TEXT;
BEGIN
    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1));

    IF LOWER(NEW.email) = 'ngocngan091002@gmail.com' THEN
        assigned_role := 'admin';
        assigned_status := 'approved';
    ELSE
        assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
        IF assigned_role = 'teacher' THEN
            assigned_status := 'pending';
        ELSE
            assigned_status := 'approved';
        END IF;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, status, phone, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        assigned_role,
        assigned_status,
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES TOÀN BỘ BẢNG
-- ========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin update profiles" ON public.profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Classes RLS
CREATE POLICY "View classes" ON public.classes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers/Admin insert classes" ON public.classes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Teachers update own classes" ON public.classes FOR UPDATE USING (
    teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Class Members RLS
CREATE POLICY "View class members" ON public.class_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Join class or Teacher add member" ON public.class_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Materials RLS
CREATE POLICY "View public or enrolled materials" ON public.materials FOR SELECT USING (
    is_public = true OR auth.role() = 'authenticated'
);
CREATE POLICY "Teachers/Admin manage materials" ON public.materials FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 5. Assignments RLS
CREATE POLICY "View assignments" ON public.assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage assignments" ON public.assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 6. Student Progress RLS
CREATE POLICY "View student progress" ON public.student_progress FOR SELECT USING (
    student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Manage student progress" ON public.student_progress FOR ALL USING (auth.role() = 'authenticated');

-- ========================================================
-- STORAGE BUCKETS SETUP (TẠO TỰ ĐỘNG BẰNG SQL)
-- ========================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('materials', 'materials', true),
  ('question-images', 'question-images', true),
  ('html5-games', 'html5-games', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Read Materials" ON storage.objects;
CREATE POLICY "Public Read Materials" ON storage.objects FOR SELECT USING (bucket_id IN ('materials', 'question-images', 'html5-games'));

DROP POLICY IF EXISTS "Authenticated Upload Materials" ON storage.objects;
CREATE POLICY "Authenticated Upload Materials" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
