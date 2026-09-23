export function normalizePhone(value: string): string | null {
    const phone = value.replace(/[\s()-]/g, '').replace(/^\+/, '');
    if (!/^[1-9]\d*$/.test(phone)) return null;
    if (!Number.isSafeInteger(Number(phone))) return null;
    return phone;
}
