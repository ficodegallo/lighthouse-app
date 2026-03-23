/** Standard API response envelope */
export interface ApiResponse<T> {
  data: T;
  success: true;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  success: true;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}
