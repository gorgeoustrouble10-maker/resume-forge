import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiSuccess } from '../types/api.types.js';

/** 统一错误码（字符串常量，便于前端分支处理与日志检索） */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  KNOWLEDGE_EMPTY: 'KNOWLEDGE_EMPTY',
  AI_UPSTREAM_ERROR: 'AI_UPSTREAM_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 业务异常：携带 HTTP 状态码与稳定错误码，由统一错误中间件转成响应 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeValue,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 成功响应的统一包装，保证 controller 层只写 res.json(ok(data)) */
export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

/** 包装 async controller，把异步异常统一交给错误中间件，避免散落 try/catch */
type AsyncController = (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
) => Promise<unknown>;

export function asyncHandler(fn: AsyncController): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** 404：未匹配到任何路由 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: ErrorCode.NOT_FOUND, message: `路由不存在: ${req.method} ${req.path}` },
  });
};

/** 集中错误处理：AppError 按约定码返回，其余兜底 500（不泄漏内部堆栈给前端） */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // 非业务异常：服务端记录完整信息，前端只看到通用提示
  // eslint-disable-next-line no-console
  console.error('[resume-forge] 未处理异常:', err);
  res.status(500).json({
    success: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message: '服务器内部错误' },
  });
};
