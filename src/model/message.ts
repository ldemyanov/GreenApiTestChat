import { ApiError } from '../api/client';

export type SendStatus = 'sending' | 'accepted' | 'failed' | 'unknown';
export type SendResult = { status: 'accepted'; idMessage: string } | { status: 'failed' | 'unknown' };

export interface Message {
    localId: string;
    chatId: string;
    idMessage?: string;
    text: string;
    timestamp: number;
    status?: SendStatus;
    direction?: 'incoming' | 'outgoing';
}

export function validateMessage(text: string): string {
    if (!text.trim()) return 'Введите текст сообщения.';
    if (text.length > 4096) return 'Сообщение не должно превышать 4096 символов.';
    return '';
}

export function failedSendStatus(error: unknown): 'failed' | 'unknown' {
    if (error instanceof ApiError) {
        if (error.kind === 'auth' || error.kind === 'rejected') return 'failed';
        // Ошибка сервера или таймаут шлюза не доказывают, что сообщение не было принято.
        if (error.kind === 'http' && error.status && error.status >= 400 && error.status < 500 && error.status !== 408)
            return 'failed';
    }
    return 'unknown';
}

export const sendStatusLabels: Record<SendStatus, string> = {
    sending: 'Отправка…',
    accepted: 'Принято к отправке',
    failed: 'Не удалось отправить. Исправьте текст или повторите отправку.',
    unknown: 'Не удалось подтвердить отправку. Сообщение уже могло уйти — не отправляйте повторно, пока не убедитесь.',
};
