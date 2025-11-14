import { PresetOption } from "@/types";

// Type declaration for process in Next.js client context
declare const process: {
  env: {
    NEXT_PUBLIC_API_URL?: string;
  };
};

// Default configuration values
export const DEFAULT_ANCHOR_MONTH = 9; // September
export const DEFAULT_ANCHOR_DAY = 17;
export const DEFAULT_MIN_DAYS = 183;
export const DEFAULT_MERGE_OVERLAPS = true;

// Validation constraints
export const MIN_MONTH = 1;
export const MAX_MONTH = 12;
export const MIN_DAY = 1;
export const MAX_DAY = 31;
export const MIN_THRESHOLD_DAYS = 0;
export const MAX_THRESHOLD_DAYS = 366;

// Preset date ranges
export const PRESET_OPTIONS: PresetOption[] = [
  { label: "Sept-Year", anchorMonth: 9, anchorDay: 17 },
  { label: "Calendar Year", anchorMonth: 1, anchorDay: 1 },
  { label: "Fiscal Year (US)", anchorMonth: 10, anchorDay: 1 },
  { label: "Academic Year", anchorMonth: 9, anchorDay: 1 },
  {
    label: "Custom",
    anchorMonth: DEFAULT_ANCHOR_MONTH,
    anchorDay: DEFAULT_ANCHOR_DAY,
  },
];

// API configuration
export const getApiUrl = (): string => {
  // Next.js replaces NEXT_PUBLIC_* env vars at build time
  // In client-side code, process.env is available for NEXT_PUBLIC_* variables
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (envUrl) {
    // Ensure the URL has a protocol
    if (envUrl.startsWith("http://") || envUrl.startsWith("https://")) {
      return envUrl;
    }
    return `https://${envUrl}`;
  }
  // Fallback - return empty string if no API URL is configured
  // The frontend should be configured with NEXT_PUBLIC_API_URL environment variable
  return "";
};

// Local storage keys
export const STORAGE_KEY_PAIRS = "date-calc-pairs";

// Animation durations (ms)
export const TRANSITION_DURATION = 300;

// Toast notification duration (ms)
export const TOAST_DURATION = 3000;
