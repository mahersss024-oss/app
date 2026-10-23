export type User = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  phoneNumber?: string;
  role?: string;
};
export type Pagination = {
  page: number;
  limit: number;
  hasMore: boolean;
  nextPage: number | null;
};
export type ListingImage = {
  id: string;
  listingId: string;
  originalUrl: string;
  displayUrl: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  status: string;
  qualityScore?: number;
  contentReviewStatus?: string;
};
export type Listing = {
  id: string;
  sellerId: string;
  title?: string;
  description?: string;
  category: string;
  price?: number | "bid" | "negotiable";
  city?: string;
  condition?: "new" | "used" | "like_new" | "damaged";
  status:
    | "draft"
    | "pending"
    | "published"
    | "paused"
    | "sold"
    | "rejected"
    | "deleted";
  images: ListingImage[];
  attributes: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  views?: number;
  messageCount?: number;
  favoriteCount?: number;
  compliance?: {
    decision: string;
    reasons?: string[];
    humanDecision?: string;
    checkStatus?: string;
  };
};
export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: string;
  type: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  reasons?: string[];
};
export type Conversation = {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  status: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
  listing?: Listing;
  unreadCount?: number;
  otherParticipant?: { id: string; name?: string; picture?: string };
};
export type Policy = {
  path?: string;
  title: string;
  updatedAt: string;
  sections: { title: string; body?: string; items?: string[] }[];
};
export type Category = {
  id: string;
  label: string;
  group: string;
  options: { id: string; label: string }[];
  optionKind?: string;
  optionLabel?: string;
  carModels?: Record<string, { id: string; label: string }[]>;
};
export type Bootstrap = {
  configurationSource?: "server" | "bundled";
  categories: Category[];
  cities: string[];
  policies: Record<string, Policy>;
  limits: {
    maxListingImages: number;
    maxImageBytes: number;
    maxProfileImageBytes: number;
    maxListingsPerSeller: number;
  };
  auth: { google: boolean; apple: boolean };
  policyVersions: Record<string, string>;
  attributes?: { categoryOption: string; carModel: string };
  siteMessage?: {
    message: string;
    type: string;
    expiresAt: string | null;
  } | null;
};
export type UploadAsset = { uri: string; name: string; type: string };
