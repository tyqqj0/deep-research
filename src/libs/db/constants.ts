// Literature item source types
export const LITERATURE_SOURCES = {
  MANUAL: 'manual',
  SEARCH: 'search', 
  IMPORT: 'import',
  KNOWLEDGE: 'knowledge',
  ZOTERO: 'zotero'
} as const;

export type LiteratureSource = typeof LITERATURE_SOURCES[keyof typeof LITERATURE_SOURCES];

// Source display names and descriptions
export const SOURCE_METADATA = {
  [LITERATURE_SOURCES.MANUAL]: {
    name: 'Manual Entry',
    description: 'Manually added by user',
    icon: '✏️',
    color: 'bg-blue-100 text-blue-800'
  },
  [LITERATURE_SOURCES.SEARCH]: {
    name: 'Search Result',
    description: 'Added from search results',
    icon: '🔍',
    color: 'bg-green-100 text-green-800'
  },
  [LITERATURE_SOURCES.IMPORT]: {
    name: 'File Import',
    description: 'Imported from file',
    icon: '📄',
    color: 'bg-purple-100 text-purple-800'
  },
  [LITERATURE_SOURCES.KNOWLEDGE]: {
    name: 'Knowledge Base',
    description: 'Added from knowledge base',
    icon: '🧠',
    color: 'bg-yellow-100 text-yellow-800'
  },
  [LITERATURE_SOURCES.ZOTERO]: {
    name: 'Zotero',
    description: 'Synced from Zotero',
    icon: '📚',
    color: 'bg-red-100 text-red-800'
  }
} as const;

// Default values
export const DEFAULT_LIBRARY_ITEM_SOURCE = LITERATURE_SOURCES.MANUAL;