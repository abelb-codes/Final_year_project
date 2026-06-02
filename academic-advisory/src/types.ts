export type Role = 'student' | 'staff' | 'admin';
export type AccessLevel = Role | 'super_admin';

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
}

export interface User {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  email: string;
  role: Role;
  access_level?: AccessLevel;
  is_super_admin?: boolean;
  is_active?: boolean;
  student_id?: string;
  department?: string;
  departments?: string[];
  department_ids?: number[];
  job_title?: string;
  year_of_study?: number | null;
}

export interface StudentSummary {
  id: number;
  name: string;
  username: string;
  email: string;
  case_count: number;
  latest_case_reference: string;
  latest_case_status: string;
}

export type CaseStatusCode = 'P' | 'IP' | 'RS' | 'RJ';
export type CasePriorityCode = 'N' | 'H' | 'U';
export type CaseCategoryCode = 'AC' | 'AR' | 'WS' | 'AD' | 'DI';

export interface CasePerson {
  id: number;
  name: string;
  username: string;
}

export interface CaseDepartment {
  id: number;
  name: string;
}

export interface CaseDocument {
  id: number;
  file: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface CaseMessage {
  id: number;
  case_id: number;
  sender: CasePerson & {
    role: Role;
  };
  message: string;
  attachment: string;
  created_at: string;
}

export interface CaseLog {
  id: number;
  action_type: string;
  action_label: string;
  message: string;
  performed_by: string;
  created_at: string;
}

export interface AcademicCase {
  id: number;
  reference_code: string;
  title: string;
  description: string;
  category: CaseCategoryCode;
  category_label: string;
  priority: CasePriorityCode;
  priority_label: string;
  status: CaseStatusCode;
  status_label: string;
  routing_source: string;
  routing_source_label: string;
  routing_notes: string;
  resolution_notes: string;
  created_at: string;
  updated_at: string;
  student: CasePerson;
  staff: CasePerson | null;
  department: CaseDepartment | null;
  documents?: CaseDocument[];
  messages?: CaseMessage[];
  logs?: CaseLog[];
}

export interface NotificationItem {
  id: number;
  notification_type: string;
  notification_label: string;
  message: string;
  created_at: string;
  is_read: boolean;
  case_id: number | null;
  reference_code: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  rejected: number;
  unread_count: number;
}

export interface AdminDashboardStats {
  students: number;
  staff: number;
  admins: number;
  notifications_sent: number;
  cases: Omit<DashboardStats, 'unread_count'>;
  recent_cases: AcademicCase[];
  recent_activity: Array<{
    id: number;
    action_label: string;
    message: string;
    performed_by: string;
    created_at: string;
  }>;
  department_load: Array<{
    name: string;
    case_count: number;
  }>;
}

export interface DepartmentOption {
  id: number;
  name: string;
  faculty: string | { id: number; name: string };
}

export interface StaffOption {
  id: number;
  name: string;
  username: string;
  job_title: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface FacultyItem {
  id: number;
  name: string;
  department_count?: number;
}
