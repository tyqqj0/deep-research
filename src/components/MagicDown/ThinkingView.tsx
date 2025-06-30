import React from 'react';
import MagicDownView from './View';

interface ThinkingViewProps {
  content: string;
}

export function ThinkingView({ content }: ThinkingViewProps) {
  // 处理RESEARCH_TASKS标签的特殊渲染
  const processThinkingContent = (text: string) => {
    const researchTasksRegex = /<RESEARCH_TASKS>(.*?)<\/RESEARCH_TASKS>/;
    
    return text.replace(researchTasksRegex, (match, tasksContent) => {
      return `
## 🎯 研究任务规划

\`\`\`research-tasks
${tasksContent.trim()}
\`\`\`
`;
    });
  };

  // 添加学术研究阶段标识符处理
  const addPhaseIndicators = (text: string) => {
    return text
      .replace(/## 1\. 回顾研究主题/g, '## 📋 1. 回顾研究主题')
      .replace(/## 1\. Academic Topic Review/g, '## 📋 1. Academic Topic Review')
      .replace(/## 2\. 回顾已有研究成果/g, '## 📚 2. 回顾已有研究成果') 
      .replace(/## 2\. Previous Academic Findings Review/g, '## 📚 2. Previous Academic Findings Review')
      .replace(/## 3\. 深度分析思考/g, '## 🔍 3. 深度学术分析思考')
      .replace(/## 3\. Deep Academic Analysis & Thinking/g, '## 🔍 3. Deep Academic Analysis & Thinking')
      .replace(/## 4\. 研究任务规划/g, '## 🎯 4. 学术研究任务规划')
      .replace(/## 4\. Academic Research Task Planning/g, '## 🎯 4. Academic Research Task Planning')
      .replace(/🔄 正在生成具体搜索任务\.\.\./g, '## ⚙️ 正在生成学术搜索任务...\n\n请稍候，正在将学术规划转换为具体的论文搜索任务格式...')
      .replace(/✅ \*\*生成的搜索任务:\*\*/g, '## ✅ 生成的学术搜索任务')
      .replace(/Target types of sources/g, '📄 **目标文献类型**')
      .replace(/Key academic databases/g, '🏛️ **重点学术数据库**')
      .replace(/Specific research methodologies/g, '🔬 **研究方法论**');
  };

  const enhancedContent = addPhaseIndicators(processThinkingContent(content));

  return <MagicDownView>{enhancedContent}</MagicDownView>;
}

export default ThinkingView;