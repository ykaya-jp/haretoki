export interface ProjectConditions {
  area?: string[];
  dateRange?: string;
  guestCount?: number;
  budget?: { min: number; max: number };
  style?: string[];
}
