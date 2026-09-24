import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../app/App';

vi.mock('../../hooks/useNotificationLoop', () => ({
    useNotificationLoop: () => ({ status: 'running', reason: '', retry: vi.fn() }),
}));

const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function login() {
    fetchMock.mockResolvedValueOnce(response({ stateInstance: 'authorized' }));
    fireEvent.change(screen.getByLabelText('idInstance'), { target: { value: '9999000000' } });
    fireEvent.change(screen.getByLabelText('apiTokenInstance'), { target: { value: 'fake' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }));
    await screen.findByRole('heading', { name: 'Чаты' });
}
function enterPhone(phone: string) {
    fireEvent.change(screen.getByLabelText('Номер телефона'), { target: { value: phone } });
}
function submit() {
    fireEvent.click(screen.getByRole('button', { name: 'Создать чат' }));
}

it('создаёт через Enter, выбирает чаты и исключает дубли по номеру и chatId', async () => {
    const user = userEvent.setup();
    render(<App />);
    await login();
    expect(screen.getByText('Выберите чат или создайте новый')).toBeVisible();
    enterPhone('+7 (900) 000-00-01');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ exist: true, chatId: '100' }));
    await user.click(screen.getByLabelText('Номер телефона'));
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: '+79000000001' })).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/checkAccount/'),
        expect.objectContaining({
            method: 'POST',
            body: '{"phoneNumber":79000000001}',
            headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(screen.getByLabelText('Номер телефона')).toHaveValue('');
    enterPhone('79000000002');
    fetchMock.mockResolvedValueOnce(response({ exist: true, chatId: '200' }));
    submit();
    await screen.findByRole('heading', { name: '+79000000002' });
    await user.click(screen.getByRole('button', { name: '+79000000001 Нет сообщений' }));
    expect(screen.getByRole('heading', { name: '+79000000001' })).toBeVisible();
    enterPhone('+7 (900) 000-00-02');
    submit();
    await screen.findByRole('heading', { name: '+79000000002' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    enterPhone('79000000003');
    fetchMock.mockResolvedValueOnce(response({ exist: true, chatId: '100' }));
    submit();
    await screen.findByRole('heading', { name: '+79000000001' });
    expect(within(screen.getByRole('list', { name: 'Список чатов' })).getAllByRole('button')).toHaveLength(2);
    enterPhone('79000000003');
    submit();
    expect(fetchMock).toHaveBeenCalledTimes(4);
});

it.each([
    [{ exist: false, chatId: '' }, /Возможно, его нет в Telegram/],
    [{ status: false, reason: 'private secret' }, /не смог выполнить поиск/],
    [{ data: { reason: 'rate_limit_exceeded', retryAfter: 30 } }, /Повторите через 30 сек/],
    [{ exist: true, chatId: '' }, /Не удалось распознать/],
    [{ exist: true, chatId: '123@g.us' }, /Не удалось распознать/],
])('сохраняет номер и не создаёт чат при ответе %j', async (body, message) => {
    render(<App />);
    await login();
    fetchMock.mockResolvedValueOnce(response(body));
    enterPhone('79000000001');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Номер телефона')).toHaveValue('79000000001');
    expect(screen.getByText('Нет чатов. Укажите номер получателя.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Создать чат' })).toBeEnabled();
});

it('проверяет номер до запроса и блокирует сетевые действия после ошибки учётных данных', async () => {
    render(<App />);
    await login();
    enterPhone('000abc');
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('Введите международный номер');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({}, 401));
    enterPhone('79000000001');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('подключитесь заново');
    expect(screen.getByRole('button', { name: 'Создать чат' })).toBeDisabled();
});

it('сохраняет изменённый во время поиска номер и блокирует повтор', async () => {
    render(<App />);
    await login();
    let finish: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    enterPhone('79000000001');
    submit();
    const pending = screen.getByRole('button', { name: 'Проверка…' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    enterPhone('79000000002');
    await act(async () => {
        finish?.(response({ exist: true, chatId: '100' }));
    });
    expect(screen.getByRole('heading', { name: '+79000000001' })).toBeVisible();
    expect(screen.getByLabelText('Номер телефона')).toHaveValue('79000000002');
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('очищает чаты при выходе и игнорирует ответ старого поиска после нового входа', async () => {
    render(<App />);
    await login();
    fetchMock.mockResolvedValueOnce(response({ exist: true, chatId: '100' }));
    enterPhone('79000000001');
    submit();
    await screen.findByRole('heading', { name: '+79000000001' });
    let finish: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    enterPhone('79000000002');
    submit();
    const signal = fetchMock.mock.calls[2][1]?.signal;
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(signal?.aborted).toBe(true);
    await login();
    await act(async () => {
        finish?.(response({ exist: true, chatId: '200' }));
    });
    expect(screen.getByText('Нет чатов. Укажите номер получателя.')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

async function createChat(phone = '79000000001', chatId = '100') {
    fetchMock.mockResolvedValueOnce(response({ exist: true, chatId }));
    enterPhone(phone);
    submit();
    await screen.findByRole('heading', { name: `+${phone}` });
}
function compose(text: string) {
    fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: text } });
}
function send() {
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
}
function conversation() {
    return within(screen.getByRole('region', { name: 'Переписка' }));
}

it('отправляет исходный текст по chatId и показывает приём API без отметок доставки', async () => {
    render(<App />);
    await login();
    await createChat();
    const text = '  Привет\n<em>текст</em>  ';
    compose(text);
    fetchMock.mockResolvedValueOnce(response({ idMessage: '123' }));
    send();
    expect(await screen.findByText('Принято к отправке')).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/sendMessage/'),
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ chatId: '100', message: text }),
        }),
    );
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
    expect(screen.queryByText('Введите текст сообщения.')).not.toBeInTheDocument();
    const messages = screen.getByRole('list', { name: 'Сообщения' });
    expect(within(messages).getAllByRole('listitem')).toHaveLength(1);
    expect(messages.querySelector('em')).toBeNull();
    expect(messages.textContent).toContain(text);
});

it('сохраняет перенос Shift+Enter, не отправляет во время IME и отправляет по Enter', async () => {
    const user = userEvent.setup();
    render(<App />);
    await login();
    await createChat();
    await user.click(screen.getByLabelText('Сообщение'));
    await user.type(screen.getByLabelText('Сообщение'), 'Первая');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Первая\n');
    const input = screen.getByLabelText('Сообщение');
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValueOnce(response({ idMessage: '1' }));
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Принято к отправке')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('проверяет пустой текст и границу 4096 без обрезки', async () => {
    render(<App />);
    await login();
    await createChat();
    expect(screen.queryByText('Введите текст сообщения.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Сообщение')).toHaveAttribute('aria-invalid', 'false');
    compose(' \n ');
    expect(screen.getByText('Введите текст сообщения.')).toBeVisible();
    expect(screen.getByLabelText('Сообщение')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    compose('');
    expect(screen.queryByText('Введите текст сообщения.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Сообщение')).toHaveAttribute('aria-invalid', 'false');
    compose('a'.repeat(4097));
    expect(screen.getByText('Сообщение не должно превышать 4096 символов.')).toBeVisible();
    fireEvent.keyDown(screen.getByLabelText('Сообщение'), { key: 'Enter' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Сообщение')).toHaveValue('a'.repeat(4097));
    compose('a'.repeat(4096));
    expect(screen.getByLabelText('Сообщение')).toHaveAttribute('aria-invalid', 'false');
    fetchMock.mockResolvedValueOnce(response({ idMessage: '1' }));
    send();
    expect(await screen.findByText('Принято к отправке')).toBeVisible();
});

it.each([
    [400, {}, 'Не удалось отправить.'],
    [200, { status: false }, 'Не удалось отправить.'],
    [500, {}, 'Не удалось подтвердить отправку.'],
    [408, {}, 'Не удалось подтвердить отправку.'],
    [200, {}, 'Не удалось подтвердить отправку.'],
    [200, { idMessage: '' }, 'Не удалось подтвердить отправку.'],
])('сохраняет текст при ответе %s %j и не повторяет автоматически', async (status, body, label) => {
    render(<App />);
    await login();
    await createChat();
    compose('Сохранить текст');
    fetchMock.mockResolvedValueOnce(response(body, status));
    send();
    expect(await screen.findByText(new RegExp(label))).toBeVisible();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Сохранить текст');
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockResolvedValueOnce(response({ idMessage: 'retry' }));
    send();
    expect(await screen.findByText('Принято к отправке')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('сетевой сбой и таймаут дают unknown без повтора', async () => {
    render(<App />);
    await login();
    await createChat();
    compose('Проверка');
    fetchMock.mockRejectedValueOnce(new Error('secret URL'));
    send();
    await screen.findByText(/Не удалось подтвердить отправку/);
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
        (_url, init) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            }),
    );
    send();
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(screen.getAllByText(/Не удалось подтвердить отправку/)).toHaveLength(2);
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Проверка');
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('привязывает результаты к исходным чатам, разрешает параллельную отправку и сохраняет правку черновика', async () => {
    render(<App />);
    await login();
    await createChat();
    let finishFirst: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finishFirst = resolve;
            }),
    );
    compose('Первое');
    send();
    expect(screen.getByRole('button', { name: 'Отправка…' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('Сообщение'), { key: 'Enter' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    compose('Изменённый черновик');
    await createChat('79000000002', '200');
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
    expect(screen.queryByText('Введите текст сообщения.')).not.toBeInTheDocument();
    compose('Второе');
    fetchMock.mockResolvedValueOnce(response({ idMessage: 'second' }));
    send();
    await screen.findByText('Принято к отправке');
    compose('Черновик второго');
    await act(async () => {
        finishFirst?.(response({ idMessage: 'first' }));
    });
    expect(screen.getByRole('heading', { name: '+79000000002' })).toBeVisible();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Черновик второго');
    expect(conversation().queryByText('Первое')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+79000000001 Первое' }));
    expect(conversation().getByText('Первое')).toBeVisible();
    expect(conversation().getByText('Принято к отправке')).toBeVisible();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Изменённый черновик');
});

it('блокирует создание и отправку после ошибки авторизации', async () => {
    render(<App />);
    await login();
    await createChat();
    compose('Текст');
    fetchMock.mockResolvedValueOnce(response({}, 401));
    send();
    expect(await screen.findByRole('alert')).toHaveTextContent('подключитесь заново');
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Создать чат' })).toBeDisabled();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Текст');
});

it('отменяет отправку при выходе и не восстанавливает старую переписку после нового входа', async () => {
    render(<App />);
    await login();
    await createChat();
    let finish: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    compose('Старое сообщение');
    send();
    const signal = fetchMock.mock.calls[2][1]?.signal;
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(signal?.aborted).toBe(true);
    await login();
    await createChat();
    compose('Новый черновик');
    await act(async () => {
        finish?.(response({ idMessage: 'old' }));
    });
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Новый черновик');
    expect(conversation().getByText('Нет сообщений')).toBeVisible();
    expect(screen.queryByText('Старое сообщение')).not.toBeInTheDocument();
});
