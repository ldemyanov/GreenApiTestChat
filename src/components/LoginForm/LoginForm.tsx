import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { validateCredentials } from '../../model/session';
import type { Credentials } from '../../model/session';
import styles from './LoginForm.module.css';

interface LoginFormProps {
    pending: boolean;
    error: string;
    onConnect: (credentials: Credentials) => Promise<void>;
}

export function LoginForm({ pending, error, onConnect }: LoginFormProps) {
    const [idInstance, setIdInstance] = useState('');
    const [apiTokenInstance, setApiTokenInstance] = useState('');
    const [errors, setErrors] = useState({ idInstance: '', apiTokenInstance: '' });
    const idInput = useRef<HTMLInputElement>(null);
    const tokenInput = useRef<HTMLInputElement>(null);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        const credentials = { idInstance: idInstance.trim(), apiTokenInstance: apiTokenInstance.trim() };
        const nextErrors = validateCredentials(credentials);
        setErrors(nextErrors);
        if (nextErrors.idInstance || nextErrors.apiTokenInstance) {
            (nextErrors.idInstance ? idInput : tokenInput).current?.focus();
            return;
        }
        void onConnect(credentials);
    }

    return (
        <section className={styles.card} aria-labelledby="login-title">
            <p className={styles.brand}>GREEN-API · Telegram</p>
            <h1 id="login-title">Вход</h1>
            <p className={styles.description}>Введите данные инстанса из личного кабинета GREEN-API.</p>
            <form onSubmit={submit} noValidate aria-busy={pending}>
                <div className={styles.field}>
                    <label htmlFor="instance-id">idInstance</label>
                    <input
                        ref={idInput}
                        id="instance-id"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        spellCheck={false}
                        value={idInstance}
                        required
                        onChange={(event) => setIdInstance(event.target.value)}
                        aria-invalid={Boolean(errors.idInstance)}
                        aria-describedby={errors.idInstance ? 'instance-error' : undefined}
                    />
                    {errors.idInstance && (
                        <p className={styles.error} id="instance-error">
                            {errors.idInstance}
                        </p>
                    )}
                </div>
                <div className={styles.field}>
                    <label htmlFor="instance-token">apiTokenInstance</label>
                    <input
                        ref={tokenInput}
                        id="instance-token"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={apiTokenInstance}
                        required
                        onChange={(event) => setApiTokenInstance(event.target.value)}
                        aria-invalid={Boolean(errors.apiTokenInstance)}
                        aria-describedby={errors.apiTokenInstance ? 'token-error' : undefined}
                    />
                    {errors.apiTokenInstance && (
                        <p className={styles.error} id="token-error">
                            {errors.apiTokenInstance}
                        </p>
                    )}
                </div>
                <button className={styles.submit} type="submit" disabled={pending}>
                    {pending ? 'Подключение…' : 'Подключиться'}
                </button>
            </form>
            <div aria-live="polite">
                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}
            </div>
            <p className={styles.note}>Сессия хранится только в памяти и сбрасывается при обновлении страницы.</p>
        </section>
    );
}
