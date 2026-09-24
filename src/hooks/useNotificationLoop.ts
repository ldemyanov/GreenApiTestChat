import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { receiveNotification, deleteNotification } from '../api/greenApi';
import { ApiError } from '../api/client';
import { parseNotification } from '../model/notifications';
import type { Chat, ChatAction } from '../model/chatReducer';
import type { Session } from '../model/session';

function pause(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const done = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', done);
            resolve();
        };
        const timer = setTimeout(done, ms);
        signal.addEventListener('abort', done, { once: true });
        if (signal.aborted) done();
    });
}

export function useNotificationLoop(
    session: Session,
    dispatch: Dispatch<ChatAction>,
    blocked: boolean,
    onAuthFailure: () => void,
    chats: Chat[],
) {
    const allowedChats = useRef(chats);
    useLayoutEffect(() => {
        allowedChats.current = chats;
    }, [chats]);
    const [status, setStatus] = useState<'running' | 'retrying' | 'stopped'>('running');
    const [reason, setReason] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (blocked) return;
        const controller = new AbortController();
        const { signal } = controller;
        async function run() {
            let failures = 0;
            setStatus('running');
            setReason('');
            while (!signal.aborted) {
                let confirming = false;
                try {
                    const raw = await receiveNotification(session, signal);
                    if (signal.aborted) return;
                    const notification = parseNotification(raw, (chatId) =>
                        allowedChats.current.some((chat) => chat.chatId === chatId),
                    );
                    if (notification) {
                        if (notification.message)
                            dispatch({ type: 'incoming', message: notification.message, name: notification.name });
                        // Даже после false очередь сверяется следующим receive, а не повторным delete.
                        confirming = true;
                        await deleteNotification(session, notification.receiptId, signal);
                        if (signal.aborted) return;
                    }
                    failures = 0;
                    setStatus('running');
                } catch (error) {
                    if (signal.aborted) return;
                    const temporary =
                        error instanceof ApiError &&
                        ((confirming && error.kind === 'format') ||
                            error.kind === 'network' ||
                            error.kind === 'timeout' ||
                            (error.kind === 'http' &&
                                (error.status === 408 ||
                                    error.status === 429 ||
                                    (error.status !== undefined && error.status >= 500))));
                    if (!temporary) {
                        setStatus('stopped');
                        setReason(
                            error instanceof ApiError && error.kind === 'format'
                                ? 'Неизвестный или повреждённый формат уведомления. Получение остановлено.'
                                : 'Получение сообщений остановлено. Проверьте подключение и настройки инстанса и повторите попытку.',
                        );
                        if (error instanceof ApiError && error.kind === 'auth') onAuthFailure();
                        return;
                    }
                    setStatus('retrying');
                    const delay = Math.max(
                        Math.min(1000 * 2 ** Math.min(failures++, 5), 30000),
                        error.retryAfterMs ?? 0,
                    );
                    await pause(delay, signal);
                }
            }
        }
        // Strict Mode успевает отменить пробный эффект до первого обращения к очереди.
        void Promise.resolve().then(() => {
            if (!signal.aborted) return run();
        });
        return () => controller.abort();
    }, [session, dispatch, blocked, onAuthFailure, attempt]);
    return {
        status,
        reason,
        retry: () => {
            if (status === 'stopped' && !blocked) setAttempt((value) => value + 1);
        },
    };
}
