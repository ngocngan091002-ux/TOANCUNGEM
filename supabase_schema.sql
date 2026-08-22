-- ========================================================
-- DATABASE SCHEMA: TOÁN CÙNG EM (LỚP 2)
-- Supabase PostgreSQL Setup File
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BẢNG PROFILES (NGƯỜI DÙNG & PHÂN QUYỀN)
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

-- 4. BẢNG HỌC LIỆU (LEARNING MATERIALS)
CREATE TABLE IF NOT EXISTS public.learning_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('video', 'ppt', 'word', 'image', 'other')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. BẢNG TRÒ CHƠI (GAMES)
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    game_url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. BẢNG NHIỆM VỤ HÀNG NGÀY (DAILY TASKS)
CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. BẢNG HOÀN THÀNH NHIỆM VỤ (TASK COMPLETIONS)
CREATE TABLE IF NOT EXISTS public.task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (task_id, student_id)
);

-- 8. BẢNG BÀI TẬP & BÀI KIỂM TRA (ASSIGNMENTS)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('exercise', 'weekly_test')),
    is_finalized BOOLEAN DEFAULT false, -- Chỉ khi giáo viên chốt mới giao tới học sinh
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. BẢNG CÂU HỎI BÀI TẬP (ASSIGNMENT QUESTIONS)
CREATE TABLE IF NOT EXISTS public.assignment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    options JSONB NOT NULL, -- Format: [{"id": "a", "text": "Đáp án A", "image_url": "..."}, ...]
    correct_answers JSONB NOT NULL, -- Format: ["a"] hoặc ["a", "b"] nếu nhiều đáp án
    points NUMERIC DEFAULT 10,
    order_index INT DEFAULT 0
);

-- 10. BẢNG BÀI NỘP CỦA HỌC SINH (ASSIGNMENT SUBMISSIONS)
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

-- 11. BẢNG CÂU TRẢ LỜI & BỘ ĐẾM THỜI GIAN THEO CÂU (QUESTION RESPONSES)
CREATE TABLE IF NOT EXISTS public.question_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.assignment_questions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    selected_options JSONB NOT NULL,
    time_spent_seconds INT NOT NULL DEFAULT 0, -- Bộ đếm thời gian riêng từng câu
    is_correct BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. BẢNG DỮ LIỆU PHÂN TÍCH AI (AI LEARNING ANALYTICS)
CREATE TABLE IF NOT EXISTS public.ai_learning_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    weak_topics JSONB DEFAULT '[]'::jsonb,
    summary_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, class_id)
);

-- ========================================================
-- AUTOMATIC PROFILE TRIGGER (XỬ LÝ ĐĂNG KÝ MỚI)
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    assigned_status TEXT;
    user_full_name TEXT;
    user_phone TEXT;
BEGIN
    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1));
    user_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
    
    -- Kiểm tra Admin tối cao: ngocngan091002@gmail.com
    IF LOWER(NEW.email) = 'ngocngan091002@gmail.com' THEN
        assigned_role := 'admin';
        assigned_status := 'approved';
    ELSE
        assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
        -- Giáo viên cần Admin duyệt mới được đăng nhập
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
        user_phone,
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

-- Gắn Trigger vào auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_analytics ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Allow public read access to profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Classes Policies
CREATE POLICY "Anyone authenticated can view classes" ON public.classes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers and Admins can create classes" ON public.classes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Teachers can update their classes" ON public.classes FOR UPDATE USING (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Class Members Policies
CREATE POLICY "Read class members" ON public.class_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers add class members" ON public.class_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Learning Materials Policies
CREATE POLICY "Read learning materials" ON public.learning_materials FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage learning materials" ON public.learning_materials FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 5. Games Policies
CREATE POLICY "Read games" ON public.games FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage games" ON public.games FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 6. Daily Tasks Policies
CREATE POLICY "Read daily tasks" ON public.daily_tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage daily tasks" ON public.daily_tasks FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 7. Task Completions Policies
CREATE POLICY "Read task completions" ON public.task_completions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Students insert own completion" ON public.task_completions FOR INSERT WITH CHECK (student_id = auth.uid());

-- 8. Assignments Policies
CREATE POLICY "Read assignments" ON public.assignments FOR SELECT USING (
    is_finalized = true OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Teachers manage assignments" ON public.assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 9. Assignment Questions Policies
CREATE POLICY "Read assignment questions" ON public.assignment_questions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage assignment questions" ON public.assignment_questions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 10. Submissions & Question Responses Policies
CREATE POLICY "Read assignment submissions" ON public.assignment_submissions FOR SELECT USING (
    student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Students insert assignment submissions" ON public.assignment_submissions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Teachers update submissions" ON public.assignment_submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

CREATE POLICY "Read question responses" ON public.question_responses FOR SELECT USING (
    student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Students insert question responses" ON public.question_responses FOR INSERT WITH CHECK (student_id = auth.uid());

-- 11. AI Analytics Policies
CREATE POLICY "Read AI Analytics" ON public.ai_learning_analytics FOR SELECT USING (
    student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Manage AI Analytics" ON public.ai_learning_analytics FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- ========================================================
-- STORAGE BUCKETS SETUP (TẠO TỰ ĐỘNG BẰNG SQL)
-- ========================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('materials', 'materials', true),
  ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Cấp quyền xem và upload file cho Buckets
DROP POLICY IF EXISTS "Public Read Materials" ON storage.objects;
CREATE POLICY "Public Read Materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Authenticated Insert Materials" ON storage.objects;
CREATE POLICY "Authenticated Insert Materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materials');

DROP POLICY IF EXISTS "Public Read Question Images" ON storage.objects;
CREATE POLICY "Public Read Question Images" ON storage.objects FOR SELECT USING (bucket_id = 'question-images');

DROP POLICY IF EXISTS "Authenticated Insert Question Images" ON storage.objects;
CREATE POLICY "Authenticated Insert Question Images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'question-images');

