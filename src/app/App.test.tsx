import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../hooks/useNotificationLoop', () => ({
    useNotificationLoop: () => ({ status: 'running', reason: '', retry: vi.fn() }),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function fillCredentials() {
    fireEvent.change(screen.getByLabelText('idInstance'), { target: { value: ' 9999000000 ' } });
    fireEvent.change(screen.getByLabelText('apiTokenInstance'), { target: { value: ' Fake-Token ' } });
}

function submit() {
    fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }));
}

describe('Подключение', () => {
    it('проверяет поля до запроса и переводит фокус на ошибку', () => {
        render(<App />);
        submit();
        expect(screen.getByText('Введите idInstance.')).toBeVisible();
        expect(screen.getByText('Введите apiTokenInstance.')).toBeVisible();
        expect(screen.getByLabelText('idInstance')).toHaveFocus();
        fireEvent.change(screen.getByLabelText('idInstance'), { target: { value: '12abc' } });
        submit();
        expect(screen.getByText('idInstance должен содержать только цифры.')).toBeVisible();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('подключается через Enter, нормализует края полей и очищает данные при выходе', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ stateInstance: 'authorized' })));
        const user = userEvent.setup();
        render(<App />);
        fillCredentials();
        await user.click(screen.getByLabelText('apiTokenInstance'));
        await user.keyboard('{Enter}');
        expect(await screen.findByRole('heading', { name: 'Чаты' })).toBeVisible();
        expect(fetchMock).toHaveBeenCalledWith(
            'https://9999.api.green-api.com/waInstance9999000000/getStateInstance/Fake-Token',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        await user.click(screen.getByRole('button', { name: 'Выйти' }));
        expect(screen.getByLabelText('idInstance')).toHaveValue('');
        expect(screen.getByLabelText('apiTokenInstance')).toHaveValue('');
        expect(screen.getByLabelText('apiTokenInstance')).toHaveAttribute('type', 'password');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
        [200, { stateInstance: 'notAuthorized' }, /Инстанс не готов/],
        [401, {}, /Проверьте idInstance и apiTokenInstance/],
        [503, {}, /GREEN-API отклонил запрос/],
        [200, {}, /Не удалось распознать состояние/],
    ])('обрабатывает ответ %s %j и сохраняет поля', async (status, body, message) => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
        render(<App />);
        fillCredentials();
        submit();
        expect(await screen.findByRole('alert')).toHaveTextContent(message);
        expect(screen.getByLabelText('apiTokenInstance')).toHaveValue(' Fake-Token ');
        expect(screen.getByRole('button', { name: 'Подключиться' })).toBeEnabled();
        expect(screen.queryByRole('heading', { name: 'Чаты' })).not.toBeInTheDocument();
    });

    it('скрывает детали сетевой ошибки и позволяет повторить запрос', async () => {
        fetchMock.mockRejectedValueOnce(new Error('URL with secret Fake-Token'));
        fetchMock.mockResolvedValueOnce(new Response('{"stateInstance":"authorized"}'));
        render(<App />);
        fillCredentials();
        submit();
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться');
        expect(screen.getByRole('alert')).not.toHaveTextContent('Fake-Token');
        submit();
        expect(await screen.findByRole('heading', { name: 'Чаты' })).toBeVisible();
    });

    it('отменяет запрос через 15 секунд и блокирует повторную отправку', async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                }),
        );
        render(<App />);
        fillCredentials();
        submit();
        const button = screen.getByRole('button', { name: 'Подключение…' });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await act(() => vi.advanceTimersByTimeAsync(15000));
        expect(screen.getByRole('alert')).toHaveTextContent('Время ожидания истекло');
        expect(screen.getByRole('button', { name: 'Подключиться' })).toBeEnabled();
    });

    it('отменяет запрос при размонтировании и игнорирует поздний ответ', async () => {
        let finish: ((response: Response) => void) | undefined;
        fetchMock.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const { unmount } = render(<App />);
        fillCredentials();
        submit();
        const signal = fetchMock.mock.calls[0][1]?.signal;
        unmount();
        expect(signal?.aborted).toBe(true);
        render(<App />);
        await act(async () => {
            finish?.(new Response('{"stateInstance":"authorized"}'));
        });
        expect(screen.getByRole('heading', { name: 'Вход' })).toBeVisible();
    });
});
