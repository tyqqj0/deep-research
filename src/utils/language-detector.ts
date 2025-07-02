// 语言自动识别工具
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return "en"; // 默认英语
  }

  const cleanText = text.toLowerCase().trim();
  
  // 中文检测（简体和繁体）
  const chineseRegex = /[\u4e00-\u9fff]/;
  if (chineseRegex.test(cleanText)) {
    return "zh-CN";
  }
  
  // 日文检测
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
  if (japaneseRegex.test(cleanText)) {
    return "ja";
  }
  
  // 韩文检测
  const koreanRegex = /[\uac00-\ud7af]/;
  if (koreanRegex.test(cleanText)) {
    return "ko";
  }
  
  // 阿拉伯文检测
  const arabicRegex = /[\u0600-\u06ff]/;
  if (arabicRegex.test(cleanText)) {
    return "ar";
  }
  
  // 俄文检测
  const russianRegex = /[\u0400-\u04ff]/;
  if (russianRegex.test(cleanText)) {
    return "ru";
  }
  
  // 德文特征词检测
  const germanWords = ["der", "die", "das", "und", "ist", "nicht", "mit", "für", "von", "auf", "eine", "einen", "einem"];
  const germanMatches = germanWords.filter(word => cleanText.includes(word)).length;
  if (germanMatches >= 2) {
    return "de";
  }
  
  // 法文特征词检测
  const frenchWords = ["le", "de", "et", "un", "il", "être", "et", "en", "avoir", "que", "pour", "dans", "ce", "son", "une"];
  const frenchMatches = frenchWords.filter(word => cleanText.includes(word)).length;
  if (frenchMatches >= 2) {
    return "fr";
  }
  
  // 西班牙文特征词检测
  const spanishWords = ["el", "de", "que", "y", "a", "en", "un", "es", "se", "no", "te", "lo", "le", "da", "su", "por", "son"];
  const spanishMatches = spanishWords.filter(word => cleanText.includes(word)).length;
  if (spanishMatches >= 2) {
    return "es";
  }
  
  // 意大利文特征词检测
  const italianWords = ["il", "di", "che", "e", "la", "a", "un", "per", "in", "con", "non", "da", "su", "le", "si"];
  const italianMatches = italianWords.filter(word => cleanText.includes(word)).length;
  if (italianMatches >= 2) {
    return "it";
  }
  
  // 葡萄牙文特征词检测
  const portugueseWords = ["o", "de", "que", "e", "do", "a", "um", "para", "é", "com", "não", "uma", "os", "no", "se"];
  const portugueseMatches = portugueseWords.filter(word => cleanText.includes(word)).length;
  if (portugueseMatches >= 2) {
    return "pt";
  }
  
  // 荷兰文特征词检测
  const dutchWords = ["de", "het", "van", "een", "en", "in", "te", "dat", "op", "met", "voor", "is", "aan", "als", "zijn"];
  const dutchMatches = dutchWords.filter(word => cleanText.includes(word)).length;
  if (dutchMatches >= 2) {
    return "nl";
  }
  
  // 默认为英语
  return "en";
}

// 获取语言对应的prompt指令
export function getLanguagePrompt(languageCode: string): string {
  const languageMap: Record<string, string> = {
    "zh-CN": "请用中文回答",
    "ja": "日本語で回答してください",
    "ko": "한국어로 답변해주세요", 
    "ar": "يرجى الإجابة باللغة العربية",
    "ru": "Пожалуйста, отвечайте на русском языке",
    "de": "Bitte antworten Sie auf Deutsch",
    "fr": "Veuillez répondre en français",
    "es": "Por favor responda en español",
    "it": "Si prega di rispondere in italiano",
    "pt": "Por favor, responda em português",
    "nl": "Gelieve te antwoorden in het Nederlands",
    "en": "Please respond in English"
  };
  
  return languageMap[languageCode] || languageMap["en"];
}

// 自动检测并生成语言提示
export function getAutoLanguagePrompt(text: string): string {
  const detectedLanguage = detectLanguage(text);
  return getLanguagePrompt(detectedLanguage);
}