export type ChatAccountType = 'customer' | 'admin' | 'superadmin';

export type ChatConversationStatus = 'open' | 'closed';

export interface ChatActor {
  sub: string;
  email?: string | null;
  username?: string | null;
  account_type: ChatAccountType;
}

export interface ChatPagination {
  page?: number;
  limit?: number;
}

export interface ChatSendMessageInput {
  content: string;
  customer_id?: string;
}