export enum UserRole {
  Patient = 'patient',
  Caregiver = 'caregiver',
}

export enum CareCircleRole {
  Admin = 'admin',
  Contributor = 'contributor',
  Viewer = 'viewer',
}

export enum ComplexityLevel {
  Full = 'full',
  Simplified = 'simplified',
  AudioOnly = 'audio_only',
}

export interface UserPreferences {
  /** Time to deliver morning briefing, e.g. "07:30" (24h, local time) */
  briefingTime: string;
  /** TTS speed multiplier — default 0.85 */
  speechRate: number;
  /** ElevenLabs voice ID */
  voiceId?: string;
  complexityLevel: ComplexityLevel;
  /** IANA timezone, e.g. "America/Chicago" */
  timezone: string;
  /** Whether to auto-play audio when briefing notification is tapped */
  autoPlayAudio: boolean;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  preferences: UserPreferences;
  createdAt: string;
}

export interface CareCircleMember {
  id: string;
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  patientId: string;
  role: CareCircleRole;
  joinedAt: string;
}

export interface InviteCaregiverRequest {
  email: string;
  name: string;
  role: CareCircleRole;
}

export interface UpdatePreferencesRequest {
  briefingTime?: string;
  speechRate?: number;
  voiceId?: string;
  complexityLevel?: ComplexityLevel;
  timezone?: string;
  autoPlayAudio?: boolean;
}
