export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  photoURL: string;
  bio?: string;
  walletBalance: number; // For monetization (Stars/Coins)
  withdrawnEarnings?: number; // Total amount withdrawn to bank/UPI (INR)
  verified?: boolean; // Blue badge
  friends?: string[]; // Array of friend UIDs
  joinedAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  likes: string[]; // List of user UIDs who liked
  commentsCount: number;
  sharesCount: number;
  createdAt: number;
}

export interface Reel {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  videoUrl: string;
  caption: string;
  likes: string[];
  commentsCount: number;
  viewsCount?: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  postId: string; // post ID or reel ID
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface Chat {
  id: string; // unique conversation ID (usually sortedUids.join('_'))
  participants: string[]; // Array of user UIDs
  lastMessage?: string;
  lastMessageTime?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  members: string[]; // Array of user UIDs
  creatorId: string;
  createdAt: number;
}

export interface Page {
  id: string;
  name: string;
  category: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  followers: string[]; // Array of user UIDs
  creatorId: string;
  createdAt: number;
}

export interface LiveStream {
  id: string;
  hostId: string;
  hostName: string;
  hostPhoto: string;
  title: string;
  active: boolean;
  viewers: string[]; // UIDs
  createdAt: number;
}

export interface LiveChatMessage {
  id: string;
  streamId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  createdAt: number;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  type: 'like' | 'comment' | 'friend_request' | 'gift' | 'live_started' | 'friend_accepted';
  targetId: string; // ID of post / reel / live / chat
  text: string;
  read: boolean;
  createdAt: number;
}

export interface TransactionHistory {
  id: string;
  userId: string;
  type: 'purchase_coins' | 'sent_gift' | 'received_gift' | 'sent_payment' | 'received_payment' | 'payment_request_accepted' | 'payment_request_received';
  amount: number; // positive or negative
  description: string;
  createdAt: number;
}

export interface PaymentRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterPhoto: string;
  targetUserId: string;
  targetUserName: string;
  amount: number;
  description: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}
