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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export async function checkAccount(
    credentials: Credentials,
    phoneNumber: string,
    signal: AbortSignal,
): Promise<string | null> {
    const { idInstance, apiTokenInstance } = credentials;
    const data = await requestJson(
        `https://${idInstance.slice(0, 4)}.api.green-api.com/waInstance${idInstance}/checkAccount/${encodeURIComponent(apiTokenInstance)}`,
        signal,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: Number(phoneNumber) }),
        },
    );
    if (!isRecord(data)) throw new ApiError('format', 'Не удалось распознать ответ поиска аккаунта.');
    const details = isRecord(data.data) ? data.data : data;
    if (data.reason === 'rate_limit_exceeded' || details.reason === 'rate_limit_exceeded') {
        const retryAfter = details.retryAfter ?? data.retryAfter;
        const delay =
            typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0
                ? ` Повторите через ${Math.ceil(retryAfter)} сек.`
                : ' Повторите попытку позже.';
        throw new ApiError('account', `Превышен лимит поиска аккаунтов.${delay}`);
    }
    if (data.status === false)
        throw new ApiError(
            'account',
            'GREEN-API не смог выполнить поиск аккаунта. Проверьте номер и повторите попытку.',
        );
    if (data.exist === false) return null;
    if (data.exist === true && typeof data.chatId === 'string' && /^[1-9]\d*$/.test(data.chatId)) return data.chatId;
    throw new ApiError('format', 'Не удалось распознать ответ поиска аккаунта.');
}

export async function sendMessage(
    credentials: Credentials,
    chatId: string,
    message: string,
    signal: AbortSignal,
): Promise<string> {
    const { idInstance, apiTokenInstance } = credentials;
    const data = await requestJson(
        `https://${idInstance.slice(0, 4)}.api.green-api.com/waInstance${idInstance}/sendMessage/${encodeURIComponent(apiTokenInstance)}`,
        signal,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message }),
        },
    );
    if (isRecord(data) && data.status === false) {
        throw new ApiError('rejected', 'GREEN-API отклонил отправку сообщения.');
    }
    if (!isRecord(data) || typeof data.idMessage !== 'string' || !data.idMessage.trim()) {
        throw new ApiError('format', 'Не удалось подтвердить отправку сообщения.');
    }
    return data.idMessage;
}
