import { chatTitle } from '../../model/chatReducer';
import type { Session } from '../../model/session';
import { useChats } from '../../hooks/useChats';
import { ChatList } from '../ChatList/ChatList';
import { CreateChatForm } from '../CreateChatForm/CreateChatForm';
import { MessageList } from '../MessageList/MessageList';
import { MessageComposer } from '../MessageComposer/MessageComposer';
import styles from './ChatLayout.module.css';

export function ChatLayout({ session, onExit }: { session: Session; onExit: () => void }) {
    const { 
        chats,
        activeChatId,
        receiving,
        pending,
        blocked,
        error,
        createChat,
        selectChat,
        updateDraft,
        sendToChat
    } = useChats(session);

    const activeChat = chats.find((chat) => chat.chatId === activeChatId);
    
    return (
        <main className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Чаты">
                <h1>Чаты</h1>
                <CreateChatForm pending={pending} blocked={blocked} error={error} onCreate={createChat} />
                <ChatList chats={chats} activeChatId={activeChatId} onSelect={selectChat} />
            </aside>
            <section className={styles.conversation} aria-label="Переписка">
                <header className={styles.header}>
                    <h2>{activeChat ? chatTitle(activeChat) : 'Telegram'}</h2>
                    <button type="button" onClick={onExit}>
                        Выйти
                    </button>
                </header>
                {(receiving.status !== 'running' || blocked) && (
                    <div className={styles.notice} role="status">
                        <p>
                            {blocked
                                ? 'Проверьте учётные данные. Нажмите «Выйти» и подключитесь заново.'
                                : receiving.status === 'retrying'
                                  ? 'Нет связи с очередью сообщений. Повторная попытка…'
                                  : receiving.reason}
                        </p>
                        {receiving.status === 'stopped' && !blocked && (
                            <button type="button" onClick={receiving.retry}>
                                Повторить получение
                            </button>
                        )}
                    </div>
                )}
                {activeChat ? (
                    <>
                        <MessageList key={activeChat.chatId} messages={activeChat.messages} />
                        <MessageComposer
                            key={`composer-${activeChat.chatId}`}
                            text={activeChat.draft}
                            pending={activeChat.messages.some((message) => message.status === 'sending')}
                            blocked={blocked}
                            onChange={(text) => updateDraft(activeChat.chatId, text)}
                            onSend={() => sendToChat(activeChat.chatId)}
                        />
                    </>
                ) : (
                    <div className={styles.empty}>Выберите чат или создайте новый</div>
                )}
            </section>
        </main>
    );
}
