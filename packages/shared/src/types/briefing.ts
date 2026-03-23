export enum BriefingSectionKey {
  Today = 'today',
  ThisWeek = 'this_week',
  Remember = 'remember',
}

export interface BriefingSection {
  key: BriefingSectionKey;
  title: string;
  content: string;
  /** Memory IDs included in this section */
  memoryIds: string[];
}

export interface Briefing {
  id: string;
  userId: string;
  date: string;
  sections: BriefingSection[];
  /** Full narrative text sent to TTS */
  fullText: string;
  /** S3 signed URL for the audio file */
  audioUrl?: string;
  deliveredAt?: string;
  openedAt?: string;
  audioPlayedAt?: string;
  createdAt: string;
}

export interface BriefingEngagementUpdate {
  openedAt?: string;
  audioPlayedAt?: string;
}
