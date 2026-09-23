import { useEffect, useReducer, useRef, useState } from 'react';
import { checkAccount } from '../api/greenApi';
import { ApiError } from '../api/client';
import { chatReducer, initialChatState } from '../model/chatReducer';
import { useSendMessage } from './useSendMessage';
import type { Session } from '../model/session';

export function useChats(session: Session) {
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [blocked, setBlocked] = useState(false);
    const request = useRef<AbortController | null>(null);

    function blockSession() {
        setBlocked(true);
        setError('Проверьте учётные данные. Нажмите «Выйти» и подключитесь заново.');
    }

    const send = useSendMessage(session, dispatch, blocked, blockSession);

    useEffect(
        () => () => {
            request.current?.abort();
            request.current = null;
        },
        [],
    );

    async function createChat(phone: string): Promise<boolean> {
        if (request.current || blocked) return false;
        setError('');
        const existing = state.chats.find((chat) => chat.phoneNumbers.includes(phone));
        if (existing) {
            dispatch({ type: 'select', chatId: existing.chatId });
            return true;
        }
        const controller = new AbortController();
        request.current = controller;
        setPending(true);
        try {
            const chatId = await checkAccount(session, phone, controller.signal);
            if (request.current !== controller) return false;
            if (!chatId) {
                setError(
                    'Не удалось найти доступный аккаунт по этому номеру. Возможно, его нет в Telegram или скрыт настройками приватности.',
                );
                return false;
            }
            dispatch({ type: 'open', chatId, phone, createdAt: Date.now() });
            return true;
        } catch (cause) {
            if (request.current !== controller || controller.signal.aborted) return false;
            if (cause instanceof ApiError && cause.kind === 'auth') {
                blockSession();
            } else {
                setError(cause instanceof ApiError ? cause.message : 'Не удалось создать чат. Повторите попытку.');
            }
            return false;
        } finally {
            if (request.current === controller) {
                request.current = null;
                setPending(false);
            }
        }
    }

    return {
        ...state,
        pending,
        error,
        blocked,
        createChat,
        updateDraft: (chatId: string, text: string) => dispatch({ type: 'draft', chatId, text }),
        sendToChat: (chatId: string) => {
            const chat = state.chats.find((item) => item.chatId === chatId);
            if (chat) void send(chat);
        },
        selectChat: (chatId: string) => dispatch({ type: 'select', chatId }),
    };
}
