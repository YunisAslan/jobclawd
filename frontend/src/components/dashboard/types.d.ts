export interface WeeklyChartEntry {
  date: string;
  count: number;
}

export interface CVPerformanceEntry {
  cv_name: string;
  sent: number;
  replies: number;
}

export interface StatsResponse {
  today_count: number;
  total_sent: number;
  total_replies: number;
  weekly_chart: WeeklyChartEntry[];
  cv_performance: CVPerformanceEntry[];
}
