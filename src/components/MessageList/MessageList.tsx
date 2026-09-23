import { useEffect, useRef } from 'react';
import type { Message } from '../../model/message';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import styles from './MessageList.module.css';

export function MessageList({ messages }: { messages: Message[] }) {
    const list = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (list.current) list.current.scrollTop = list.current.scrollHeight;
    }, [messages]);

    if (!messages.length) {
        return <p className={styles.empty}>Нет сообщений</p>;
    }

    return (
        <ul className={styles.list} ref={list} aria-label="Сообщения" aria-live="polite" tabIndex={0}>
            {messages.map((message) => (
                <MessageBubble key={message.localId} message={message} />
            ))}
        </ul>
    );
}
