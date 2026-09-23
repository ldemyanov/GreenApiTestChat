import type { Credentials } from '../model/session';
import { ApiError, requestJson } from './client';

export async function getStateInstance(credentials: Credentials, signal: AbortSignal): Promise<string> {
    const { idInstance, apiTokenInstance } = credentials;
    const baseUrl = `https://${idInstance.slice(0, 4)}.api.green-api.com`;
    const data = await requestJson(
        `${baseUrl}/waInstance${idInstance}/getStateInstance/${encodeURIComponent(apiTokenInstance)}`,
        signal,
    );
    if (
        typeof data !== 'object' ||
        data === null ||
        !('stateInstance' in data) ||
        typeof data.stateInstance !== 'string' ||
        !data.stateInstance
    ) {
        throw new ApiError('format', 'Не удалось распознать состояние инстанса. Повторите попытку позже.');
    }
    return data.stateInstance;
}
