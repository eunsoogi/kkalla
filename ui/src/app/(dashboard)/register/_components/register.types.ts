export interface ChecklistItem {
  label: string;
  detail: string;
  complete: boolean;
}

export interface ScheduleToggleSwitchProps {
  isRiskAcknowledged: boolean;
}
