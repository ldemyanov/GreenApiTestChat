import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { getStateInstance } from '../api/greenApi';
import type { Credentials, Session } from '../model/session';

export function useSession() {
    const [session, setSession] = useState<Session | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const activeRequest = useRef<AbortController | null>(null);

    useEffect(
        () => () => {
            activeRequest.current?.abort();
            activeRequest.current = null;
        },
        [],
    );

    async function connect(credentials: Credentials) {
        if (activeRequest.current) return;

        const controller = new AbortController();

        activeRequest.current = controller;
        setPending(true);
        setError('');

        try {
            const state = await getStateInstance(credentials, controller.signal);
            if (activeRequest.current !== controller) return;

            if (state !== 'authorized') {
                setError('Инстанс не готов к работе. Проверьте авторизацию Telegram в кабинете GREEN-API.');
                return;
            }
            
            setSession({ ...credentials, id: crypto.randomUUID() });
        } catch (cause) {
            if (activeRequest.current !== controller || controller.signal.aborted) return;
            setError(cause instanceof ApiError ? cause.message : 'Не удалось подключиться. Повторите попытку.');
        } finally {
            if (activeRequest.current === controller) {
                activeRequest.current = null;
                setPending(false);
            }
        }
    }

    function disconnect() {
        activeRequest.current?.abort();
        activeRequest.current = null;
        setSession(null);
        setPending(false);
        setError('');
    }

    return { session, pending, error, connect, disconnect };
}
