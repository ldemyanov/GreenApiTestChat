import { StrictMode, useReducer } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useNotificationLoop } from './useNotificationLoop';
import { chatReducer, initialChatState } from '../model/chatReducer';

const session = { id: 'session', idInstance: '9999000000', apiTokenInstance: 'fake' };
const fetchMock = vi.fn<typeof fetch>();
const onAuthFailure = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const event = (receiptId = 1, chatId = '100', idMessage = 'm1') => ({
    receiptId,
    body: {
        typeWebhook: 'incomingMessageReceived',
        timestamp: 1700000000,
        idMessage,
        senderData: { chatType: 'user', chatId, chatName: 'Собеседник' },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ' } },
    },
});

beforeEach(() => {
    vi.useFakeTimers();
    onAuthFailure.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(
        (_url, init) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            }),
    );
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
function mount() {
    return renderHook(
        () => {
            const [state, dispatch] = useReducer(
                chatReducer,
                chatReducer(initialChatState, { type: 'open', chatId: '100', phone: '79000000001', createdAt: 1 }),
            );
            const loop = useNotificationLoop(session, dispatch, false, onAuthFailure, state.chats);
            return { state, dispatch, loop };
        },
        { wrapper: StrictMode },
    );
}
async function flush() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
    });
}

it('последовательно подтверждает события, исключает повторы и не меняет выбор чата', async () => {
    fetchMock.mockResolvedValueOnce(json(event()));
    let confirm: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                confirm = resolve;
            }),
    );
    const { result } = mount();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('receiveTimeout=5');
    expect(fetchMock.mock.calls[1][0]).toContain('/deleteNotification/fake/1');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE');
    expect(result.current.state.activeChatId).toBe('100');
    expect(result.current.state.chats[0].messages[0]).toMatchObject({
        text: 'Ответ',
        timestamp: 1700000000000,
        direction: 'incoming',
    });
    act(() => result.current.dispatch({ type: 'open', chatId: '200', phone: '79000000002', createdAt: 1 }));
    fetchMock.mockResolvedValueOnce(json(event(2)));
    fetchMock.mockResolvedValueOnce(json({ result: false }));
    fetchMock.mockResolvedValueOnce(json(event(3, '300')));
    fetchMock.mockResolvedValueOnce(json({ result: true }));
    await act(async () => {
        confirm?.(json({ result: true }));
    });
    await flush();
    expect(result.current.state.chats.find((chat) => chat.chatId === '100')?.messages).toHaveLength(1);
    expect(result.current.state.chats.find((chat) => chat.chatId === '300')).toBeUndefined();
    expect(result.current.state.activeChatId).toBe('200');
    expect(fetchMock).toHaveBeenCalledTimes(7);
});

it('продолжает после пустого ответа, пропускает группы и исходящие события', async () => {
    fetchMock.mockResolvedValueOnce(new Response('  '));
    fetchMock.mockResolvedValueOnce(json({ receiptId: 1, body: { typeWebhook: 'outgoingAPIMessageReceived' } }));
    fetchMock.mockResolvedValueOnce(json({ result: true }));
    const group = event(2);
    group.body.senderData.chatType = 'group';
    fetchMock.mockResolvedValueOnce(json(group));
    fetchMock.mockResolvedValueOnce(json({ result: true }));
    const { result } = mount();
    await flush();
    expect(result.current.state.chats[0].messages).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(6);
});

it('после сбоя delete сверяет очередь через receive, повтор не дублирует сообщение', async () => {
    fetchMock.mockResolvedValueOnce(json(event()));
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    fetchMock.mockResolvedValueOnce(json(event()));
    fetchMock.mockResolvedValueOnce(json({ result: true }));
    const { result } = mount();
    await flush();
    expect(result.current.loop.status).toBe('retrying');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock.mock.calls[2][0]).toContain('/receiveNotification/');
    expect(result.current.state.chats[0].messages).toHaveLength(1);
    expect(result.current.loop.status).toBe('running');
});

it('останавливается на повреждённом событии без delete и разрешает ручной повтор', async () => {
    fetchMock.mockResolvedValueOnce(json({ receiptId: 1, body: { typeWebhook: 'unexpected' } }));
    const { result } = mount();
    await flush();
    expect(result.current.loop.status).toBe('stopped');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(json(event()));
    fetchMock.mockResolvedValueOnce(json({ result: true }));
    act(() => result.current.loop.retry());
    await flush();
    expect(result.current.state.chats[0].messages).toHaveLength(1);
    expect(result.current.loop.status).toBe('running');
});

it('использует нарастающую задержку, учитывает Retry-After и сбрасывает задержку после успеха', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '10' } }));
    fetchMock.mockResolvedValueOnce(new Response(''));
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    mount();
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(9999));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).toHaveBeenCalledTimes(6);
});

it('ошибка авторизации блокирует сессию и не повторяется', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401));
    const { result } = mount();
    await flush();
    expect(result.current.loop.status).toBe('stopped');
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('отменяет receive через 30 секунд, а выход отменяет запросы и повтор', async () => {
    const { result, unmount } = mount();
    await flush();
    const signal = fetchMock.mock.calls[0][1]?.signal;
    await act(() => vi.advanceTimersByTimeAsync(29999));
    expect(signal?.aborted).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(signal?.aborted).toBe(true);
    expect(result.current.loop.status).toBe('retrying');
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('игнорирует поздний ответ после выхода без подтверждения старого события', async () => {
    let finish: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const first = mount();
    await flush();
    const signal = fetchMock.mock.calls[0][1]?.signal;
    first.unmount();
    expect(signal?.aborted).toBe(true);
    const next = mount();
    await flush();
    await act(async () => {
        finish?.(json(event()));
    });
    expect(next.result.current.state.chats[0].messages).toHaveLength(0);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('deleteNotification'))).toBe(true);
});

it('подтверждает уведомление бота и принимает следующее сообщение из созданного чата', async () => {
    const bot = event(1, '999');
    bot.body.senderData.chatType = 'bot';
    fetchMock.mockResolvedValueOnce(json(bot));
    fetchMock.mockResolvedValueOnce(json({ result: true }));
    fetchMock.mockResolvedValueOnce(json(event(2)));
    fetchMock.mockResolvedValueOnce(json({ result: true }));
    const { result } = mount();
    await flush();
    expect(result.current.loop.status).toBe('running');
    expect(result.current.state.chats).toHaveLength(1);
    expect(result.current.state.chats[0].messages).toHaveLength(1);
    expect(fetchMock.mock.calls[1][0]).toContain('/deleteNotification/fake/1');
    expect(fetchMock.mock.calls[3][0]).toContain('/deleteNotification/fake/2');
});
