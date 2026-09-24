import { chatTitle } from '../../model/chatReducer';
import type { Chat } from '../../model/chatReducer';
import styles from './ChatList.module.css';

interface Props {
    chats: Chat[];
    activeChatId: string | null;
    onSelect: (chatId: string) => void;
}

export function ChatList({ chats, activeChatId, onSelect }: Props) {
    if (!chats.length) return <p className={styles.empty}>Нет чатов. Укажите номер получателя.</p>;
    const sorted = [...chats].sort(
        (a, b) =>
            (b.messages[b.messages.length - 1]?.timestamp ?? b.createdAt) -
            (a.messages[a.messages.length - 1]?.timestamp ?? a.createdAt),
    );
    return (
        <ul className={styles.list} aria-label="Список чатов">
            {sorted.map((chat) => (
                <li key={chat.chatId}>
                    <button
                        type="button"
                        aria-pressed={chat.chatId === activeChatId}
                        onClick={() => onSelect(chat.chatId)}
                    >
                        <span>{chatTitle(chat)}</span>
                        <small>{chat.messages[chat.messages.length - 1]?.text ?? 'Нет сообщений'}</small>
                    </button>
                </li>
            ))}
        </ul>
    );
}
