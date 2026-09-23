import { expect, it } from 'vitest';
import { chatReducer, initialChatState } from './chatReducer';

it('объединяет номера одного chatId и сохраняет время создания без изменения исходного состояния', () => {
    const first = chatReducer(initialChatState, { type: 'open', chatId: '100', phone: '7001', createdAt: 1 });
    const second = chatReducer(first, { type: 'open', chatId: '100', phone: '7002', createdAt: 2 });
    expect(second.chats).toEqual([
        { chatId: '100', phoneNumbers: ['7001', '7002'], createdAt: 1, messages: [], draft: '', draftRevision: 0 },
    ]);
    expect(first.chats[0].phoneNumbers).toEqual(['7001']);
    expect(chatReducer(second, { type: 'open', chatId: '100', phone: '7002', createdAt: 3 }).chats).toEqual(
        second.chats,
    );
    expect(chatReducer(second, { type: 'select', chatId: 'missing' })).toBe(second);
});

it('не очищает черновик, если текст изменили и вернули во время отправки', () => {
    let state = chatReducer(initialChatState, { type: 'open', chatId: '100', phone: '7001', createdAt: 1 });
    state = chatReducer(state, { type: 'draft', chatId: '100', text: 'Текст' });
    const revision = state.chats[0].draftRevision;
    state = chatReducer(state, {
        type: 'sending',
        chatId: '100',
        message: {
            localId: 'local',
            chatId: '100',
            text: 'Текст',
            timestamp: 2,
            status: 'sending',
        },
    });
    state = chatReducer(state, { type: 'draft', chatId: '100', text: 'Правка' });
    state = chatReducer(state, { type: 'draft', chatId: '100', text: 'Текст' });
    const previous = state;
    state = chatReducer(state, {
        type: 'sendResult',
        chatId: '100',
        localId: 'local',
        draftRevision: revision,
        result: { status: 'accepted', idMessage: 'remote' },
    });
    expect(state.chats[0].draft).toBe('Текст');
    expect(state.chats[0].messages).toHaveLength(1);
    expect(state.chats[0].messages[0]).toMatchObject({ status: 'accepted', timestamp: 2, idMessage: 'remote' });
    expect(previous.chats[0].messages[0].status).toBe('sending');
});
