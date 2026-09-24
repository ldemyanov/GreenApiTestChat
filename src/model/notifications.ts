import { ApiError } from '../api/client';
import type { Message } from './message';

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
function invalid(): never {
    throw new ApiError('format', 'Неизвестный или повреждённый формат уведомления.');
}

export interface Notification {
    receiptId: number;
    message?: Message;
    name?: string;
}

export function parseNotification(value: unknown, isChatAllowed: (chatId: string) => boolean): Notification | null {
    if (value === null) return null;
    if (
        !record(value) ||
        typeof value.receiptId !== 'number' ||
        !Number.isSafeInteger(value.receiptId) ||
        value.receiptId <= 0 ||
        !record(value.body)
    )
        return invalid();
    const result: Notification = { receiptId: value.receiptId };
    const body = value.body;
    if (typeof body.typeWebhook !== 'string') return invalid();
    const skipped = [
        'outgoingMessageReceived',
        'outgoingAPIMessageReceived',
        'outgoingMessageStatus',
        'stateInstanceChanged',
        'statusInstanceChanged',
        'deviceInfo',
        'incomingCall',
    ];
    if (skipped.includes(body.typeWebhook)) return result;
    if (body.typeWebhook !== 'incomingMessageReceived') return invalid();
    if (!record(body.senderData)) return invalid();
    const sender = body.senderData;
    if (typeof sender.chatId !== 'string' || !sender.chatId) return invalid();
    if (!isChatAllowed(sender.chatId)) return result;
    if (sender.chatType === 'group' || sender.chatType === 'bot') return result;
    if (sender.chatType !== 'user' || !record(body.messageData)) return invalid();
    const data = body.messageData;
    const ignored = [
        'imageMessage',
        'videoMessage',
        'documentMessage',
        'audioMessage',
        'stickerMessage',
        'contactMessage',
        'locationMessage',
        'pollMessage',
        'reactionMessage',
    ];
    if (typeof data.typeMessage === 'string' && ignored.includes(data.typeMessage)) return result;
    let text: unknown;
    if (data.typeMessage === 'textMessage' && record(data.textMessageData)) text = data.textMessageData.textMessage;
    else if (data.typeMessage === 'extendedTextMessage' && record(data.extendedTextMessageData))
        text = data.extendedTextMessageData.text;
    else return invalid();
    if (
        typeof text !== 'string' ||
        typeof sender.chatId !== 'string' ||
        !/^[1-9]\d*$/.test(sender.chatId) ||
        typeof body.idMessage !== 'string' ||
        !body.idMessage ||
        typeof body.timestamp !== 'number' ||
        !Number.isFinite(body.timestamp) ||
        body.timestamp < 0 ||
        body.timestamp * 1000 > 8640000000000000
    )
        return invalid();
    result.message = {
        localId: `incoming-${sender.chatId}-${body.idMessage}`,
        chatId: sender.chatId,
        idMessage: body.idMessage,
        text,
        timestamp: body.timestamp * 1000,
        direction: 'incoming',
    };
    result.name =
        typeof sender.chatName === 'string' && sender.chatName.trim()
            ? sender.chatName
            : typeof sender.senderName === 'string'
              ? sender.senderName
              : undefined;
    return result;
}
