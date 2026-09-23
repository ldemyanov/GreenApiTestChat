import type { Message } from '../../model/message';
import { sendStatusLabels } from '../../model/message';
import styles from './MessageBubble.module.css';

export function MessageBubble({ message }: { message: Message }) {
    const date = new Date(message.timestamp);
    return (
        <li className={styles.bubble}>
            <p className={styles.text}>{message.text}</p>
            <time dateTime={date.toISOString()}>
                {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </time>
            <span
                className={message.status === 'failed' || message.status === 'unknown' ? styles.error : styles.status}
            >
                {sendStatusLabels[message.status]}
            </span>
        </li>
    );
}
