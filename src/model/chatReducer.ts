import type { Message, SendResult } from './message';

export interface Chat {
    chatId: string;
    phoneNumbers: string[];
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
    | { type: 'select'; chatId: string }
    | { type: 'draft'; chatId: string; text: string }
    | { type: 'sending'; chatId: string; message: Message }
    | { type: 'sendResult'; chatId: string; localId: string; draftRevision: number; result: SendResult };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
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
