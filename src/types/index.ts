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
  parent_pin?: string;
  hide_email_on_leaderboard?: boolean;
  created_at?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  description?: string;
  grade: number;
  code: string;
  teacher_id: string;
  is_locked?: boolean;
  is_archived?: boolean;
  co_teacher_emails?: string[];
  schedule_notes?: string;
  created_at?: string;
  teacher_name?: string;
  member_count?: number;
}

export interface AttendanceRecord {
  id?: string;
  class_id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent_excused' | 'absent_unexcused' | 'late';
  note?: string;
}

export interface ConductRecord {
  id?: string;
  class_id: string;
  student_id: string;
  points_delta: number;
  reason: string;
  created_at?: string;
}

export interface PointLogRecord {
  id?: string;
  class_id?: string;
  student_id: string;
  student_name?: string;
  points_change: number;
  stars_change?: number;
  reason: string;
  icon?: string;
  type: 'reward' | 'penalty';
  created_by?: string;
  created_at?: string;
}

export interface CustomPointReason {
  id: string;
  class_id?: string;
  teacher_id?: string;
  title: string;
  points: number;
  icon: string;
  type: 'reward' | 'penalty';
  created_at?: string;
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
  question_type?: 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching' | 'essay';
  difficulty?: 'easy' | 'medium' | 'hard';
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
  time_limit_minutes?: number;
  shuffle_questions?: boolean;
  target_group?: string;
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
  assignment?: Assignment;
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
