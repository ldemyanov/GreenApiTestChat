import type { Message, SendResult } from './message';

export interface Chat {
    chatId: string;
    phoneNumbers: string[];
    name?: string;
    createdAt: number;
    messages: Message[];
    draft: string;
    draftRevision: number;
}

export interface ChatState {
    chats: Chat[];
    activeChatId: string | null;
}

export const initialChatState: ChatState = { chats: [], activeChatId: null };

export type ChatAction =
    | { type: 'open'; chatId: string; phone: string; createdAt: number }
    | { type: 'incoming'; message: Message; name?: string }
    | { type: 'select'; chatId: string }
    | { type: 'draft'; chatId: string; text: string }
    | { type: 'sending'; chatId: string; message: Message }
    | { type: 'sendResult'; chatId: string; localId: string; draftRevision: number; result: SendResult };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
    if (action.type === 'incoming') {
        const message = action.message;
        const existing = state.chats.find((chat) => chat.chatId === message.chatId);
        if (!existing || existing.messages.some((item) => item.idMessage === message.idMessage)) return state;
        const chat = existing;
        const updated = {
            ...chat,
            name: chat.name || action.name,
            messages: [...chat.messages, message].sort((a, b) => a.timestamp - b.timestamp),
        };
        return {
            ...state,
            chats: state.chats.map((item) => (item.chatId === chat.chatId ? updated : item)),
        };
    }
    if (action.type === 'select') {
        return state.chats.some((chat) => chat.chatId === action.chatId)
            ? { ...state, activeChatId: action.chatId }
            : state;
    }
    if (action.type === 'draft' || action.type === 'sending' || action.type === 'sendResult') {
        return {
            ...state,
            chats: state.chats.map((chat) => {
                if (chat.chatId !== action.chatId) return chat;
                if (action.type === 'draft') {
                    return chat.draft === action.text
                        ? chat
                        : { ...chat, draft: action.text, draftRevision: chat.draftRevision + 1 };
                }
                if (action.type === 'sending') {
                    return {
                        ...chat,
                        messages: [...chat.messages, action.message].sort((a, b) => a.timestamp - b.timestamp),
                    };
                }
                const original = chat.messages.find((message) => message.localId === action.localId);
                if (!original || original.status !== 'sending') return chat;
                return {
                    ...chat,
                    messages: chat.messages.map((message) =>
                        message.localId === action.localId ? { ...message, ...action.result } : message,
                    ),
                    draft:
                        action.result.status === 'accepted' && chat.draftRevision === action.draftRevision
                            ? ''
                            : chat.draft,
                };
            }),
        };
    }
    const existing = state.chats.find((chat) => chat.chatId === action.chatId);
    const chats = existing
        ? state.chats.map((chat) =>
              chat.chatId === action.chatId && !chat.phoneNumbers.includes(action.phone)
                  ? { ...chat, phoneNumbers: [...chat.phoneNumbers, action.phone] }
                  : chat,
          )
        : [
              ...state.chats,
              {
                  chatId: action.chatId,
                  phoneNumbers: [action.phone],
                  createdAt: action.createdAt,
                  messages: [],
                  draft: '',
                  draftRevision: 0,
              },
          ];
    return { chats, activeChatId: action.chatId };
}

export function chatTitle(chat: Chat): string {
    return chat.name || (chat.phoneNumbers[0] ? `+${chat.phoneNumbers[0]}` : chat.chatId);
}
