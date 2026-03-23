export enum MemoryType {
  Event = 'Event',
  Routine = 'Routine',
  LifeMemory = 'LifeMemory',
  QuickNote = 'QuickNote',
  Person = 'Person',
}

export enum Horizon {
  Today = 'Today',
  ThisWeek = 'ThisWeek',
  Always = 'Always',
}

export enum MemoryStatus {
  Active = 'active',
  Archived = 'archived',
  Expired = 'expired',
  Flagged = 'flagged',
}

export interface Memory {
  id: string;
  userId: string;
  content: string;
  type: MemoryType;
  horizon: Horizon;
  summary: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  status: MemoryStatus;
  personIds: string[];
  /** Attribution label shown in UI — e.g. "Added by David" */
  attributionLabel?: string;
}

export interface MemoryDraft {
  content: string;
  type: MemoryType;
  horizon: Horizon;
  summary: string;
  personIds: string[];
  expiresAt?: string;
  /** Extracted dates/times from the content */
  extractedDateTime?: string;
  /** Confidence score from AI classification (0–1) */
  confidence: number;
}

export interface CreateMemoryRequest {
  content: string;
  /** If omitted, AI classifies automatically */
  type?: MemoryType;
  horizon?: Horizon;
  expiresAt?: string;
  /** userId of the patient this memory belongs to (caregivers set this) */
  patientId?: string;
}

export interface UpdateMemoryRequest {
  content?: string;
  type?: MemoryType;
  horizon?: Horizon;
  status?: MemoryStatus;
  expiresAt?: string;
}

export interface ClassifyMemoryRequest {
  content: string;
}

export interface ClassifyMemoryResponse {
  draft: MemoryDraft;
}
