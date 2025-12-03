/**
 * API Client Helper
 * Handles communication with the FastAPI backend
 */

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
const TOKEN_KEY = 'antigravity_auth_token';

export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public data: ApiError,
    message?: string
  ) {
    super(message || `API Error: ${status}`);
    this.name = 'ApiClientError';
  }
}

/**
 * Token management
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new ApiClientError(response.status, errorData);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * GET request
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export async function apiPut<T>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'DELETE',
    body: data ? JSON.stringify(data) : undefined,
  });
}

// Type definitions for API responses
export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  hourly_rate: string;
  max_hours_per_week: number;
  role: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  name: string;
  plan: 'free' | 'pro';
  created_at: string;
  updated_at: string;
}

// Type definitions for Availability
export interface Availability {
  id: number;
  employee_id: number;
  start_time: string;
  end_time: string;
  preference_score: number;
  created_at: string;
  updated_at: string;
}

// Type definitions for Shift
export interface Shift {
  id: number;
  employee_id: number | null; // null for open shifts
  start_time: string;
  end_time: string;
  role: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftRequest {
  start_time: string;
  end_time: string;
  role?: string;
}

export interface GenerateScheduleRequest {
  organization_id: number;
  needed_shifts: ShiftRequest[];
}

// API endpoints
export interface EmployeeInvitation {
  id: number;
  employee_id: number;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  invitation_url: string;
}

export interface EmployeeInvitationAccept {
  token: string;
  password: string;
}

export const employeesApi = {
  getAll: (orgId: number) => apiGet<Employee[]>(`/employees/${orgId}`),
  create: (data: unknown) => apiPost<Employee>('/employees/', data),
  invite: (employeeId: number) => apiPost<EmployeeInvitation>(`/employees/${employeeId}/invite`, {}),
  getInvitation: (employeeId: number) => apiGet<EmployeeInvitation>(`/employees/${employeeId}/invitation`),
  acceptInvitation: (data: EmployeeInvitationAccept) => apiPost<UserWithToken>('/employees/invitations/accept', data),
  getMyProfile: () => apiGet<Employee>('/employees/me'),
  getMyShifts: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();
    return apiGet<any[]>(`/employees/me/shifts${query ? `?${query}` : ''}`);
  },
  getMyAvailability: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();
    return apiGet<Availability[]>(`/employees/me/availability${query ? `?${query}` : ''}`);
  },
};

export const availabilityApi = {
  get: (employeeId: number, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();
    return apiGet<Availability[]>(
      `/employees/availability/${employeeId}${query ? `?${query}` : ''}`
    );
  },
  create: (data: unknown) => apiPost<Availability[]>('/employees/availability', data),
  delete: (availabilityId: number) => apiDelete<void>(`/employees/availability/${availabilityId}`),
};

export const organizationsApi = {
  get: (id: number) => apiGet<Organization>(`/organizations/${id}`),
  create: (data: unknown) => apiPost<Organization>('/organizations/', data),
};

export interface TimeSlot {
  start_hour: number;
  start_minute?: number;
  end_hour: number;
  end_minute?: number;
  role: string;
  count: number;
}

export interface WeeklyDemandRequest {
  week_start_date: string; // Monday of the week (UTC, start of day)
  day_of_week: number; // 0=Monday, 6=Sunday
  time_slots: TimeSlot[];
}

export interface DemandRequest {
  start_time: string;
  end_time: string;
  role: string;
  count: number;
}

export interface AutoAssignRequest {
  start_date: string;
  end_date: string;
}

export interface DeleteRangeRequest {
  start_date: string;
  end_date: string;
}

export interface ShiftUpdateRequest {
  start_time?: string;
  end_time?: string;
  role?: string;
  employee_id?: number | null;
}

export const shiftsApi = {
  getAll: (organizationId: number) => {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId.toString());
    return apiGet<Shift[]>(`/shifts/?${params.toString()}`);
  },
  generate: (data: GenerateScheduleRequest) => apiPost<Shift[]>('/shifts/generate', data),
  createDemand: (organizationId: number, data: DemandRequest) => {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId.toString());
    return apiPost<Shift[]>(`/shifts/demand?${params.toString()}`, data);
  },
  createWeeklyDemand: (organizationId: number, data: WeeklyDemandRequest) => {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId.toString());
    return apiPost<Shift[]>(`/shifts/weekly-demand?${params.toString()}`, data);
  },
  autoAssign: (organizationId: number, data: AutoAssignRequest) => {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId.toString());
    return apiPost<Shift[]>(`/shifts/auto-assign?${params.toString()}`, data);
  },
  deleteRange: (organizationId: number, data: DeleteRangeRequest) => {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId.toString());
    params.append('start_date', data.start_date);
    params.append('end_date', data.end_date);
    return apiDelete<void>(`/shifts/range?${params.toString()}`);
  },
  update: (shiftId: number, data: ShiftUpdateRequest) => {
    return apiPut<Shift>(`/shifts/${shiftId}`, data);
  },
};

export const schedulesApi = {
  generate: (organizationId: number, weekStartDate: string) => {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId.toString());
    params.append('week_start_date', weekStartDate);
    return apiPost<Shift[]>(`/schedules/generate?${params.toString()}`);
  },
};

// Type definitions for Requirements
export interface Requirement {
  id: number;
  organization_id: number;
  week_start_date: string; // ISO date string
  day_of_week: number; // 0=Monday, 6=Sunday
  position_name: string;
  start_time: string; // Time string (HH:mm:ss)
  end_time: string; // Time string (HH:mm:ss)
  headcount: number;
  created_at: string;
  updated_at: string;
}

export interface RequirementCreate {
  organization_id: number;
  week_start_date: string; // ISO date string (must be Monday)
  day_of_week: number; // 0=Monday, 6=Sunday
  position_name: string;
  start_time: string; // Time string (HH:mm:ss)
  end_time: string; // Time string (HH:mm:ss)
  headcount: number;
}

export const requirementsApi = {
  getAll: (organizationId: number) => {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId.toString());
    return apiGet<Requirement[]>(`/requirements/?${params.toString()}`);
  },
  create: (data: RequirementCreate) => apiPost<Requirement>('/requirements/', data),
  update: (requirementId: number, data: Partial<RequirementCreate>) => apiPut<Requirement>(`/requirements/${requirementId}`, data),
  delete: (requirementId: number) => apiDelete<void>(`/requirements/${requirementId}`),
};

// Type definitions for Auth
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: 'owner' | 'manager' | 'employee';
  organization_id: number | null;
}

export interface UserWithToken extends User {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export const authApi = {
  register: (data: RegisterRequest) => apiPost<UserWithToken>('/auth/register', data),
  login: (data: LoginRequest) => apiPost<UserWithToken>('/auth/login', data),
  me: () => apiGet<User>('/auth/me'),
};

export const usersApi = {
  getOrganizationUsers: () => apiGet<User[]>('/users/organization'),
};

// Type definitions for Invitations
export interface Invitation {
  id: number;
  email: string;
  organization_id: number;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface InvitationCreate {
  email: string;
  full_name: string;
}

export interface InvitationAccept {
  token: string;
  password: string;
}

export const invitationsApi = {
  list: () => apiGet<Invitation[]>('/invitations/'),
  create: (data: InvitationCreate) => apiPost<Invitation>('/invitations/', data),
  accept: (data: InvitationAccept) => apiPost<UserWithToken>('/invitations/accept', data),
};

