export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type ActiveView = 'admin' | 'teacher' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  student_code?: string;
  phone?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  description?: string;
  grade: number;
  code: string;
  teacher_id: string;
  created_at?: string;
  teacher_name?: string;
  member_count?: number;
}

export interface ClassMember {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
  student?: UserProfile;
}

export interface Material {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  type: 'document' | 'video' | 'game_iframe' | 'game_html5';
  author_id: string;
  class_id?: string;
  is_public: boolean;
  created_at?: string;
}

export interface LearningMaterial {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: 'video' | 'ppt' | 'word' | 'image' | 'other';
  created_at?: string;
}

export interface GameItem {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  game_url: string;
  thumbnail_url?: string;
  created_at?: string;
}

export interface DailyTask {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at?: string;
  completed_count?: number;
  total_students?: number;
  is_completed?: boolean;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  student_id: string;
  completed_at: string;
  student?: UserProfile;
}

export interface QuestionOption {
  id: string;
  text: string;
  image_url?: string;
}

export interface AssignmentQuestion {
  id: string;
  assignment_id?: string;
  question_text: string;
  image_url?: string;
  options: QuestionOption[];
  correct_answers: string[];
  points: number;
  order_index: number;
}

export interface Assignment {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  material_id?: string;
  due_date?: string;
  type: 'exercise' | 'weekly_test' | 'game_quiz';
  is_finalized: boolean;
  created_at?: string;
  material?: Material;
  questions?: AssignmentQuestion[];
  submission?: AssignmentSubmission;
}

export interface StudentProgress {
  id: string;
  assignment_id: string;
  student_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  score: number;
  completion_time_seconds: number;
  completed_at?: string;
  assignment?: Assignment;
  student?: UserProfile;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  score: number;
  ai_suggested_score?: number;
  ai_suggested_remark?: string;
  teacher_remark?: string;
  status: 'submitted' | 'graded_by_ai' | 'finalized_by_teacher';
  student?: UserProfile;
  responses?: QuestionResponse[];
}

export interface QuestionResponse {
  id?: string;
  submission_id?: string;
  question_id: string;
  student_id?: string;
  selected_options: string[];
  time_spent_seconds: number;
  is_correct: boolean;
}

export interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  student_code?: string;
  avatar_url?: string;
  tasks_completed: number;
  assignment_score: number;
  test_score: number;
  total_points: number;
  rank: number;
}

export interface AIWeaknessSummary {
  student_id: string;
  student_name: string;
  weak_topics: string[];
  summary_notes: string;
  wrong_count: number;
}
