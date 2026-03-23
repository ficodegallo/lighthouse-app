import { ApiResponse, ApiErrorResponse, Memory, Briefing, User } from '@lighthouse/shared';

interface CareCircleMember {
  id: string;
  role: string;
  joinedAt: string;
  caregiver: { id: string; name: string; email: string };
}

export interface ReminderItem {
  id: string;
  memoryId: string;
  userId: string;
  triggerAt: string;
  type: string;
  status: string;
  escalationLevel: number;
  message: string;
  createdAt: string;
}

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
    });

    const data = await res.json() as ApiResponse<T> | ApiErrorResponse;

    if (!data.success) {
      throw new Error(data.error.message);
    }

    return data.data;
  }

  // Memories
  memories = {
    list: (params?: { horizon?: string; status?: string; type?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return this.request<Memory[]>(`/api/memories${query ? `?${query}` : ''}`);
    },
    classify: (content: string) =>
      this.request<{ draft: unknown }>('/api/memories/classify', {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    create: (body: { content: string; type?: string; horizon?: string; summary?: string; extractedDateTime?: string }) =>
      this.request<Memory>('/api/memories', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<Memory>) =>
      this.request<Memory>(`/api/memories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archive: (id: string) =>
      this.request<{ id: string }>(`/api/memories/${id}`, { method: 'DELETE' }),
    query: (question: string) =>
      this.request<{ answer: string }>('/api/memories/query', {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),
  };

  // Briefings
  briefings = {
    today: () => this.request<Briefing>('/api/briefings/today'),
    list: () => this.request<Briefing[]>('/api/briefings'),
    generate: () => this.request<Briefing>('/api/briefings/generate', { method: 'POST' }),
    trackAudioPlayed: (id: string) =>
      this.request<{}>(`/api/briefings/${id}/audio-played`, { method: 'POST' }),
  };

  // Users
  users = {
    me: () => this.request<User>('/api/users/me'),
    register: (body: { name: string; role: string; timezone: string }) =>
      this.request<User>('/api/users/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    registerPushToken: (token: string) =>
      this.request<{}>('/api/users/me/push-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  };

  // Reminders
  reminders = {
    list: () => this.request<ReminderItem[]>('/api/reminders'),
    acknowledge: (id: string) =>
      this.request<{}>(`/api/reminders/${id}/acknowledge`, { method: 'POST' }),
    dismiss: (id: string) =>
      this.request<{}>(`/api/reminders/${id}`, { method: 'DELETE' }),
  };

  // Caregivers
  caregivers = {
    list: () => this.request<CareCircleMember[]>('/api/caregivers'),
    invite: (email: string, name: string) =>
      this.request<{ careCircle?: unknown; inviteToken?: string; message?: string }>(
        '/api/caregivers/invite',
        { method: 'POST', body: JSON.stringify({ email, name, role: 'contributor' }) }
      ),
  };
}

export const api = new ApiClient();
