import styles from './App.module.css';
import { LoginForm } from '../components/LoginForm/LoginForm';
import { useSession } from '../hooks/useSession';

export function App() {
    const { session, pending, error, connect, disconnect } = useSession();
    return (
        <main className={styles.page}>
            {session ? (
                <section className={styles.connected} aria-labelledby="connected-title">
                    <h1 id="connected-title">Подключение выполнено</h1>
                    <p>Инстанс {session.idInstance} готов к работе.</p>
                    <p>Интерфейс чатов пока не реализован.</p>
                    <button type="button" onClick={disconnect}>
                        Выйти
                    </button>
                </section>
            ) : (
                <LoginForm pending={pending} error={error} onConnect={connect} />
            )}
        </main>
    );
}
