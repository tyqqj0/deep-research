import React from 'react';
import MagicDownView from './View';

interface ThinkingViewProps {
  content: string;
}

export function ThinkingView({ content }: ThinkingViewProps) {
  // 处理RESEARCH_TASKS标签的特殊渲染
  const processThinkingContent = (text: string) => {
    const researchTasksRegex = /<RESEARCH_TASKS>(.*?)<\/RESEARCH_TASKS>/gs;
    
    return text.replace(researchTasksRegex, (match, tasksContent) => {
      return `
## 🎯 研究任务规划

\`\`\`research-tasks
${tasksContent.trim()}
\`\`\`
`;
    });
  };

  // 添加阶段标识符处理
  const addPhaseIndicators = (text: string) => {
    return text
      .replace(/## 1\. 回顾研究主题/g, '## 📋 1. 回顾研究主题')
      .replace(/## 2\. 回顾已有研究成果/g, '## 📚 2. 回顾已有研究成果') 
      .replace(/## 3\. 深度分析思考/g, '## 🔍 3. 深度分析思考')
      .replace(/## 4\. 研究任务规划/g, '## 🎯 4. 研究任务规划')
      .replace(/🔄 正在生成具体搜索任务\.\.\./g, '## ⚙️ 正在生成具体搜索任务...\n\n请稍候，正在将规划转换为具体的搜索任务格式...')
      .replace(/✅ \*\*生成的搜索任务:\*\*/g, '## ✅ 生成的搜索任务');
  };

  const enhancedContent = addPhaseIndicators(processThinkingContent(content));

  return <MagicDownView>{enhancedContent}</MagicDownView>;
}

export default ThinkingView;