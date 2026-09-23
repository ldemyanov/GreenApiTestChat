import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import { sendMessage } from '../api/greenApi';
import { ApiError } from '../api/client';
import type { Chat, ChatAction } from '../model/chatReducer';
import type { Session } from '../model/session';
import { failedSendStatus, validateMessage } from '../model/message';

export function useSendMessage(
    session: Session,
    dispatch: Dispatch<ChatAction>,
    blocked: boolean,
    onAuthFailure: () => void,
) {
    const requests = useRef(new Map<string, AbortController>());
    useEffect(() => {
        const active = requests.current;
        return () => {
            active.forEach((controller) => controller.abort());
            active.clear();
        };
    }, []);

    async function send(chat: Chat) {
        if (blocked || requests.current.has(chat.chatId) || validateMessage(chat.draft)) return;
        const { chatId, draft: text, draftRevision } = chat;
        const localId = crypto.randomUUID();
        const controller = new AbortController();
        requests.current.set(chatId, controller);
        dispatch({
            type: 'sending',
            chatId,
            message: { localId, chatId, text, timestamp: Date.now(), status: 'sending' },
        });
        try {
            const idMessage = await sendMessage(session, chatId, text, controller.signal);
            if (requests.current.get(chatId) !== controller) return;
            dispatch({ type: 'sendResult', chatId, localId, draftRevision, result: { status: 'accepted', idMessage } });
        } catch (error) {
            if (requests.current.get(chatId) !== controller || controller.signal.aborted) return;
            dispatch({
                type: 'sendResult',
                chatId,
                localId,
                draftRevision,
                result: { status: failedSendStatus(error) },
            });
            if (error instanceof ApiError && error.kind === 'auth') onAuthFailure();
        } finally {
            if (requests.current.get(chatId) === controller) requests.current.delete(chatId);
        }
    }
    return send;
}
