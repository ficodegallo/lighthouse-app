export enum ReminderType {
  Appointment = 'appointment',
  Medication = 'medication',
  Routine = 'routine',
  DayBefore = 'day_before',
}

export enum ReminderStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Acknowledged = 'acknowledged',
  Escalated = 'escalated',
}

export interface Reminder {
  id: string;
  memoryId: string;
  userId: string;
  triggerAt: string;
  type: ReminderType;
  status: ReminderStatus;
  escalationLevel: number;
  message: string;
  createdAt: string;
}
