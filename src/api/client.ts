export class ApiError extends Error {
    readonly kind: 'http' | 'network' | 'timeout' | 'format' | 'auth' | 'account' | 'rejected';
    readonly status?: number;
    readonly retryAfterMs?: number;

    constructor(kind: ApiError['kind'], message: string, status?: number, retryAfterMs?: number) {
        super(message);
        this.kind = kind;
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }
}

export async function requestJson(
    url: string,
    signal: AbortSignal,
    options: RequestInit = {},
    config: { timeoutMs?: number; allowEmpty?: boolean } = {},
): Promise<unknown> {
    const controller = new AbortController();

    let timedOut = false;

    const abort = () => controller.abort();

    signal.addEventListener('abort', abort, { once: true });

    if (signal.aborted) controller.abort();

    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, config.timeoutMs ?? 15000);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
            const retry = response.headers.get('Retry-After');
            const retryAfterMs =
                retry === null
                    ? undefined
                    : /^\d+(\.\d+)?$/.test(retry)
                      ? Number(retry) * 1000
                      : Math.max(0, Date.parse(retry) - Date.now());
            throw new ApiError(
                response.status === 401 || response.status === 403 ? 'auth' : 'http',
                response.status === 401 || response.status === 403
                    ? 'Не удалось подключиться. Проверьте idInstance и apiTokenInstance.'
                    : 'GREEN-API отклонил запрос. Повторите попытку позже.',
                response.status,
                Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
            );
        }

        const body = await response.text();
        if (config.allowEmpty && !body.trim()) return null;

        try {
            return JSON.parse(body) as unknown;
        } catch {
            throw new ApiError('format', 'Не удалось распознать ответ GREEN-API. Повторите попытку позже.');
        }
    } catch (error) {
        if (signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
        if (timedOut) throw new ApiError('timeout', 'Время ожидания истекло. Повторите попытку.');
        if (error instanceof ApiError) throw error;
        throw new ApiError('network', 'Не удалось связаться с GREEN-API. Проверьте соединение и повторите попытку.');
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
    }
}
