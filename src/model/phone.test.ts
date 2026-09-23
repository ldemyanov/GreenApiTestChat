import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

describe('Нормализация номера', () => {
    it('сохраняет код страны и удаляет разрешённое оформление', () => {
        expect(normalizePhone(' +7 (900) 000-00-01 ')).toBe('79000000001');
        expect(normalizePhone('89000000001')).toBe('89000000001');
    });
    it.each(['', '   ', '0123', '++7123', '7+123', '@name', '7.123', '7/123', '99999999999999999'])(
        'отклоняет %s',
        (value) => {
            expect(normalizePhone(value)).toBeNull();
        },
    );
});
