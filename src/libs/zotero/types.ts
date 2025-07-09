// Zotero API types and interfaces

export interface ZoteroConfig {
  apiKey: string;
  userId?: string;
  groupId?: string;
  baseUrl?: string;
}

export interface ZoteroItem {
  key: string;
  version: number;
  itemType: string;
  title?: string;
  creators?: Array<{
    creatorType: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
  date?: string;
  publicationTitle?: string;
  abstractNote?: string;
  url?: string;
  DOI?: string;
  tags?: Array<{
    tag: string;
    type?: number;
  }>;
  collections?: string[];
  dateAdded?: string;
  dateModified?: string;
  extra?: string;
}

export interface ZoteroSyncResult {
  success: boolean;
  itemsAdded: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errors: string[];
  newItems?: any[];
  updatedItems?: any[];
}

export interface ZoteroApiResponse<T = any> {
  data: T;
  success: boolean;
  error?: string;
  details?: any;
}

export interface ZoteroUserInfo {
  userID?: string;
  username?: string;
  displayName?: string;
  email?: string;
}

export interface ZoteroCollection {
  key: string;
  version: number;
  name: string;
  parentCollection?: string;
  itemsCount?: number;
}

export interface ZoteroGroup {
  id: string;
  name: string;
  description?: string;
  type: string;
  access: string;
  library: {
    type: string;
    id: string;
    name: string;
  };
}