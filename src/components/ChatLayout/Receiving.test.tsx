import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatLayout } from './ChatLayout';

const session = { id: 'test', idInstance: '9999000000', apiTokenInstance: 'fake' };
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

it('пропускает чужие чаты, принимает ответ в созданный после запуска опроса чат и сохраняет выбор', async () => {
    let receive: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((url, init) => {
        if (String(url).includes('/checkAccount/')) {
            const body = JSON.parse(String(init?.body)) as { phoneNumber: number };
            return Promise.resolve(
                new Response(JSON.stringify({ exist: true, chatId: body.phoneNumber === 79000000001 ? '100' : '200' })),
            );
        }
        if (init?.method === 'DELETE') return Promise.resolve(new Response('{"result":true}'));
        return new Promise((resolve) => {
            receive = resolve;
        });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<ChatLayout session={session} onExit={vi.fn()} />);
    await act(async () => {});
    async function deliver(chatId: string, chatType: string, receiptId: number) {
        await act(async () => {
            receive?.(
                new Response(
                    JSON.stringify({
                        receiptId,
                        body: {
                            typeWebhook: 'incomingMessageReceived',
                            idMessage: String(receiptId),
                            timestamp: 1700000000,
                            senderData: { chatId, chatType, chatName: 'Собеседник' },
                            messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ' } },
                        },
                    }),
                ),
            );
        });
    }
    await deliver('999', 'bot', 1);
    await deliver('300', 'user', 2);
    expect(screen.getByText('Нет чатов. Укажите номер получателя.')).toBeVisible();
    for (const phone of ['79000000001', '79000000002']) {
        fireEvent.change(screen.getByLabelText('Номер телефона'), { target: { value: phone } });
        fireEvent.click(screen.getByRole('button', { name: 'Создать чат' }));
        await screen.findByRole('heading', { name: `+${phone}` });
    }
    await deliver('100', 'user', 3);
    expect(screen.getByRole('heading', { name: '+79000000002' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Собеседник Ответ' }));
    const conversation = within(screen.getByRole('region', { name: 'Переписка' }));
    expect(conversation.getByText('Ответ')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Повторить получение' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(3);
    // Создание и выбор чатов не перезапускают ожидающий receive.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/receiveNotification/'))).toHaveLength(4);
    unmount();
});
