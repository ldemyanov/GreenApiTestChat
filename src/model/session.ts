export interface Credentials {
    idInstance: string;
    apiTokenInstance: string;
}

export interface Session extends Credentials {
    id: string;
}

export function validateCredentials(credentials: Credentials) {
    return {
        idInstance: !credentials.idInstance
            ? 'Введите idInstance.'
            : !/^\d+$/.test(credentials.idInstance)
              ? 'idInstance должен содержать только цифры.'
              : '',
        apiTokenInstance: credentials.apiTokenInstance ? '' : 'Введите apiTokenInstance.',
    };
}
