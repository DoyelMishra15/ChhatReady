export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public hint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what = 'Case') => new ApiError(404, 'NOT_FOUND', `${what} not found.`, 'It may have expired or been deleted.');
