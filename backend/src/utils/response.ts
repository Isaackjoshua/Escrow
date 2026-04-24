import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
): void {
  res.status(statusCode).json({ success: true, message, data } as ApiResponse<T>);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
): void {
  res.status(statusCode).json({ success: false, message, errors } as ApiResponse);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success'
): void {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } as ApiResponse<T[]>);
}
