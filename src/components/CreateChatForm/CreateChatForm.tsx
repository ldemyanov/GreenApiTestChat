import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { normalizePhone } from '../../model/phone';
import styles from './CreateChatForm.module.css';

interface Props {
    pending: boolean;
    blocked: boolean;
    error: string;
    onCreate: (phone: string) => Promise<boolean>;
}

export function CreateChatForm({ pending, blocked, error, onCreate }: Props) {
    const [phone, setPhone] = useState('');
    const [validation, setValidation] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const currentValue = useRef('');

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending || blocked) return;
        const normalized = normalizePhone(phone);
        if (!normalized) {
            setValidation('Введите международный номер с кодом страны, без букв и добавочных номеров.');
            input.current?.focus();
            return;
        }
        setValidation('');
        const submitted = phone;
        if ((await onCreate(normalized)) && currentValue.current === submitted) {
            setPhone('');
            currentValue.current = '';
        }
    }

    return (
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate aria-busy={pending}>
            <label htmlFor="recipient-phone">Номер телефона</label>
            <input
                ref={input}
                id="recipient-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+7 900 000-00-00"
                value={phone}
                onChange={(event) => {
                    setPhone(event.target.value);
                    currentValue.current = event.target.value;
                    setValidation('');
                }}
                aria-invalid={Boolean(validation)}
                aria-describedby="phone-help phone-error"
            />
            <p id="phone-help" className={styles.hint}>
                Укажите номер с кодом страны.
            </p>
            <button type="submit" disabled={pending || blocked}>
                {pending ? 'Проверка…' : 'Создать чат'}
            </button>
            <div id="phone-error" aria-live="polite">
                {(validation || error) && (
                    <p className={styles.error} role="alert">
                        {validation || error}
                    </p>
                )}
            </div>
        </form>
    );
}
