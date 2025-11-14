// Type definitions for Date Calculator application

export type DatePair = [string, string];

export interface CalculateRequest {
  ranges: DatePair[];
  anchorMonth: number;
  anchorDay: number;
  minDays: number;
  mergeOverlaps: boolean;
  heatmap: boolean;
}

export interface CalculateResponse {
  totals: Record<string, number>;
  passes: Record<string, boolean>;
  overall_pass: boolean;
  errors: string[];
  heatmap?: Record<string, string[]>;
}

export interface SessionData {
  ranges: DatePair[];
  anchorMonth: number;
  anchorDay: number;
  minDays: number;
  mergeOverlaps: boolean;
}

export interface SessionListResponse {
  sessions: string[];
}

export interface PresetOption {
  label: string;
  anchorMonth: number;
  anchorDay: number;
}
