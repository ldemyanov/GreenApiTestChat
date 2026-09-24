import styles from './App.module.css';
import { LoginForm } from '../components/LoginForm/LoginForm';
import { ChatLayout } from '../components/ChatLayout/ChatLayout';
import { useSession } from '../hooks/useSession';

export function App() {
    const { session, pending, error, connect, disconnect } = useSession();
    
    if (session) {
        return <ChatLayout key={session.id} session={session} onExit={disconnect} />;
    }
    
    return (
        <main className={styles.page}>
            <LoginForm pending={pending} error={error} onConnect={connect} />
        </main>
    );
}
