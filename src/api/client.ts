export class ApiError extends Error {
    readonly kind: 'http' | 'network' | 'timeout' | 'format';

    constructor(kind: ApiError['kind'], message: string) {
        super(message);
        this.kind = kind;
    }
}

export async function requestJson(url: string, signal: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    
    let timedOut = false;
    
    const abort = () => controller.abort();
    
    signal.addEventListener('abort', abort, { once: true });
    
    if (signal.aborted) controller.abort();
    
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, 15000);

    try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
            throw new ApiError(
                'http',
                response.status === 401 || response.status === 403
                    ? 'Не удалось подключиться. Проверьте idInstance и apiTokenInstance.'
                    : 'GREEN-API отклонил запрос. Повторите попытку позже.',
            );
        }
        
        const body = await response.text();
        
        try {
            return JSON.parse(body) as unknown;
        } catch {
            throw new ApiError('format', 'Не удалось распознать ответ GREEN-API. Повторите попытку позже.');
        }
    } catch (error) {
        if (signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
        if (timedOut) throw new ApiError('timeout', 'Время ожидания истекло. Повторите подключение.');
        if (error instanceof ApiError) throw error;
        throw new ApiError('network', 'Не удалось связаться с GREEN-API. Проверьте соединение и повторите попытку.');
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
    }
}
