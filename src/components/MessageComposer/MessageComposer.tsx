import { useRef } from 'react';
import { validateMessage } from '../../model/message';
import styles from './MessageComposer.module.css';

interface Props {
    text: string;
    pending: boolean;
    blocked: boolean;
    onChange: (text: string) => void;
    onSend: () => void;
}

export function MessageComposer({ text, pending, blocked, onChange, onSend }: Props) {
    const composing = useRef(false);
    const invalid = validateMessage(text);
    const showError = text.length > 0 && Boolean(invalid);
    const disabled = pending || blocked || Boolean(invalid);

    return (
        <form
            className={styles.form}
            onSubmit={(event) => {
                event.preventDefault();
                if (!disabled) onSend();
            }}
        >
            <label htmlFor="message-text">Сообщение</label>
            <div className={styles.controls}>
                <textarea
                    id="message-text"
                    rows={3}
                    value={text}
                    onChange={(event) => onChange(event.target.value)}
                    aria-describedby="message-help"
                    aria-invalid={showError}
                    onCompositionStart={() => {
                        composing.current = true;
                    }}
                    onCompositionEnd={() => {
                        composing.current = false;
                    }}
                    onKeyDown={(event) => {
                        if (
                            event.key === 'Enter' &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing &&
                            !composing.current &&
                            event.keyCode !== 229
                        ) {
                            event.preventDefault();
                            if (!disabled) onSend();
                        }
                    }}
                />
                <button type="submit" disabled={disabled}>
                    {pending ? 'Отправка…' : 'Отправить'}
                </button>
            </div>
            <p id="message-help" className={showError ? styles.error : styles.hint}>
                {showError ? invalid : 'Enter — отправить, Shift+Enter — новая строка.'}
            </p>
        </form>
    );
}
