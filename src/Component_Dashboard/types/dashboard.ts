export interface DashboardStaff {
  total_active: number;
  total_enrolled: number;
  total_unenrolled: number;
  enrolled_this_week: number;
  enrolled_this_month: number;
}

export interface DashboardAttendance {
  checked_in: number;
  checked_out: number;
  still_inside: number;
  absent: number;
}

export interface ProjectCheckinRow {
  project_guid: string | null;
  projectname: string | null;
  entityname: string | null;
  checked_in: number;
  checked_out: number;
  still_inside: number;
}

export interface TopProjectRow {
  projectname: string | null;
  checkin_count: number;
}

export interface DashboardProjects {
  total_active: number;
  checkins_by_project: ProjectCheckinRow[];
  top_projects_today: TopProjectRow[];
}

export interface TrendPoint {
  date: string;
  checked_in: number;
  checked_out: number;
}

export interface DashboardData {
  date: string;
  staff: DashboardStaff;
  attendance: DashboardAttendance;
  projects: DashboardProjects;
  trend_last_7_days: TrendPoint[];
}
