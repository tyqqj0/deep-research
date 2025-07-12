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
    name: 'library.literatureSources.manualEntry',
    description: 'library.literatureSources.manuallyAddedByUser',
    icon: '✏️',
    color: 'bg-blue-100 text-blue-800'
  },
  [LITERATURE_SOURCES.SEARCH]: {
    name: 'library.literatureSources.searchResult',
    description: 'library.literatureSources.addedFromSearchResults',
    icon: '🔍',
    color: 'bg-green-100 text-green-800'
  },
  [LITERATURE_SOURCES.IMPORT]: {
    name: 'library.literatureSources.fileImport',
    description: 'library.literatureSources.importedFromFile',
    icon: '📄',
    color: 'bg-purple-100 text-purple-800'
  },
  [LITERATURE_SOURCES.KNOWLEDGE]: {
    name: 'library.literatureSources.knowledgeBase',
    description: 'library.literatureSources.addedFromKnowledgeBase',
    icon: '🧠',
    color: 'bg-yellow-100 text-yellow-800'
  },
  [LITERATURE_SOURCES.ZOTERO]: {
    name: 'library.literatureSources.zotero',
    description: 'library.literatureSources.syncedFromZotero',
    icon: '📚',
    color: 'bg-red-100 text-red-800'
  }
} as const;

// Default values
export const DEFAULT_LIBRARY_ITEM_SOURCE = LITERATURE_SOURCES.MANUAL;