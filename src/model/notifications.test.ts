import { expect, it } from 'vitest';
import { parseNotification as parse } from './notifications';
import { chatReducer, initialChatState } from './chatReducer';

const parseNotification = (value: unknown) => parse(value, (chatId) => chatId === '100');
const body = {
    typeWebhook: 'incomingMessageReceived',
    idMessage: '123',
    timestamp: 1700000000,
    senderData: { chatId: '100', chatType: 'user', senderName: 'Имя' },
    messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'https://example.com' } },
};
it('извлекает текст ссылки и имя, привязывает сообщения по chatId и исключает дубли', () => {
    const notification = parseNotification({ receiptId: 1, body });
    expect(notification?.message?.text).toBe('https://example.com');
    if (!notification?.message) throw new Error('Missing message');
    const opened = chatReducer(initialChatState, { type: 'open', chatId: '100', phone: '79000000001', createdAt: 1 });
    const state = chatReducer(opened, {
        type: 'incoming',
        message: notification.message,
        name: notification.name,
    });
    expect(state.activeChatId).toBe('100');
    expect(state.chats[0].name).toBe('Имя');
    expect(chatReducer(state, { type: 'incoming', message: notification.message })).toBe(state);
    const second = chatReducer(state, { type: 'incoming', message: { ...notification.message, chatId: '200' } });
    expect(second).toBe(state);
    const linked = chatReducer(state, { type: 'open', chatId: '100', phone: '79000000001', createdAt: 1 });
    expect(linked.chats).toHaveLength(1);
    expect(linked.chats[0].messages).toHaveLength(1);
});
it.each([
    {},
    { receiptId: '1', body },
    { receiptId: 1, body: { ...body, timestamp: Infinity } },
    { receiptId: 1, body: { ...body, messageData: { typeMessage: 'textMessage' } } },
])('отклоняет повреждённое событие %j', (value) => {
    expect(() => parseNotification(value)).toThrow();
});
it('осознанно пропускает вложение', () => {
    expect(
        parseNotification({ receiptId: 1, body: { ...body, messageData: { typeMessage: 'imageMessage' } } }),
    ).toEqual({ receiptId: 1 });
});

it.each(['bot', 'user', 'group'])('пропускает чужой чат %s до разбора содержимого', (chatType) => {
    expect(
        parseNotification({
            receiptId: 1,
            body: { ...body, senderData: { chatId: '999', chatType }, messageData: null },
        }),
    ).toEqual({ receiptId: 1 });
});
it('входящее не создаёт чат в reducer', () => {
    const notification = parseNotification({ receiptId: 1, body });
    if (!notification?.message) throw new Error('Missing message');
    expect(chatReducer(initialChatState, { type: 'incoming', message: notification.message })).toBe(initialChatState);
});
