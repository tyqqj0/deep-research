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
}

export interface ZoteroApiResponse<T = any> {
  data: T;
  success: boolean;
  error?: string;
}