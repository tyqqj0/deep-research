// 测试分隔符修复的效果
// 使用您提供的实际问题数据

const problemData = `Shubham Agarwal, Issam H Laradji, Laurent Charlin, and Christopher Pal. LitlIm: A toolkit for scientific literature review. arXiv preprint arXiv:2402.01788, 2024.
$REF_SEPARATOR$
Jinheon Baek, Alham Fikri Aji, and Amir Saffari. Knowledge- augmented language model prompting for zero- shot knowledge graph question answering, 2023. URL https://arxiv.org/abs/2306.04136. Jinheon Baek, Sujay Kumar Jauhar, Silviu Cucerzan, and Sung Ju Hwang. Researchagent: Iterative research idea generation over scientific literature with large language models. arXiv preprint arXiv:2404.07738, 2024.
$REF_SEPARATOR$
Borui Cai, Yong Xiang, Longxiang Gao, He Zhang, Yunfeng Li, and Jianxin Li. Temporal knowledge graph completion: A survey. arXiv preprint arXiv:2201.08236, 2022.
$REF_SEPARATOR$
Shelly Chaiken. Dual- process theories in social psychology. Guilford Press google schola, 2:206- 214, 1999.
$REF_SEPARATOR$
Xin Cheng, Di Luo, Xiuying Chen, Lemao Liu, Dongyan Zhao, and Rui Yan. Lift yourself up: Retrieval- augmented text generation with self memory, 2023. URL https://arxiv.org/abs/2305.02437. Darren Edge, Ha Trinh, Newman Cheng, Joshua Bradley, Alex Chao, Apurva Mody, Steven Truitt, and Jonathan Larson. From local to global: A graph rag approach to query- focused summarization. arXiv preprint arXiv:2404.16130, 2024. Elsevier. https://www.elsevier.com/products/scopus/scopus- ai. https://www.elsevier.com/products/scopus/scopus- ai, 2024.`;

// 复制修复后的智能拆分函数
function smartSplitReferences(rawText) {
    // 🔧 第一步：检查是否已经有分隔符存在
    if (rawText.includes('$REF_SEPARATOR$')) {
        console.log('🔧 发现已有分隔符，直接按分隔符拆分');
        return rawText
            .split(/\n?\$REF_SEPARATOR\$\n?/)
            .map(ref => ref.trim())
            .filter(ref => ref.length > 0);
    }

    // 第二步：基础拆分 - 按换行符拆分
    let entries = rawText
        .split(/\n/)
        .map(ref => ref.trim())
        .filter(ref => ref.length > 0);

    // 第三步：检查是否需要智能拆分
    // 条件：只有一行，或者某行过长（可能包含多个引文）
    const needsSmartSplit = entries.length === 1 ||
        entries.some(entry => entry.length > 300);

    if (needsSmartSplit) {
        console.log('🧠 启用智能拆分模式...');
        
        // 第四步：智能拆分 - 使用边界检测
        const combinedText = entries.join(' ');

        // 边界模式：年份后跟句号，然后是作者姓名
        // 例如：2024a.Siheng Xiong, 2024b.Wenjie Xu
        // 支持带字母后缀的年份和完整的作者姓名
        const boundaryPattern = /(\b(?:19|20)\d{2}[a-z]?\.)\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/g;

        // 在边界前插入特殊分隔符
        const separatedText = combinedText.replace(boundaryPattern, '$1\n$REF_SEPARATOR$\n$2');

        // 按分隔符拆分并清理
        entries = separatedText
            .split(/\n\$REF_SEPARATOR\$\n/)
            .map(ref => ref.trim())
            .filter(ref => ref.length > 0);
    }

    return entries;
}

// 复制解析函数
function parseReferenceEntry(reference) {
    const result = {};

    // 🎯 重点信息1：年份提取（用户最关心）
    const yearMatch = reference.match(/\b(19|20)\d{2}[a-z]?\b/);
    if (yearMatch) {
        result.year = parseInt(yearMatch[0].replace(/[a-z]/g, ''));
    }

    // 🎯 重点信息2：标题提取（用户最关心）
    // 策略：标题通常在作者之后，年份之前，或者被引号包围
    const titlePatterns = [
        // 引号包围的标题
        /"([^"]+)"/,
        // 句号结尾的标题（在年份前）
        /\.([^.]+)\.\s*(?:19|20)\d{2}/,
        // 在作者和年份之间的文本
        /^[^.]+\.([^.]+?)\.?\s*(?:19|20)\d{2}/,
        // 新增：arXiv 格式的标题提取
        /^[^.]+\.\s*([^.]+?)\.\s*arXiv/i
    ];

    for (const pattern of titlePatterns) {
        const titleMatch = reference.match(pattern);
        if (titleMatch && titleMatch[1]) {
            result.title = titleMatch[1].trim();
            break;
        }
    }

    // 🔗 DOI 提取（精确匹配）
    const doiMatch = reference.match(/(?:doi[:\s]*|DOI[:\s]*)(10\.\d+\/[^\s,]+)/i);
    if (doiMatch) {
        result.doi = doiMatch[1];
    }

    // 🌐 URL 提取
    const urlMatch = reference.match(/(?:URL\s+)?(https?:\/\/[^\s,]+)/i);
    if (urlMatch) {
        result.url = urlMatch[1];
    }

    // 📄 arXiv ID 提取
    const arxivMatch = reference.match(/arXiv[:\s]*([0-9]{4}\.[0-9]{4,5})/i);
    if (arxivMatch) {
        result.arxivId = arxivMatch[1];
    }

    // 👥 作者提取（启发式）
    // 策略：通常在引文开头，第一个句号前
    const authorMatch = reference.match(/^([^.]+?)(?:\.|,)/);
    if (authorMatch && authorMatch[1]) {
        const authorText = authorMatch[1].trim();
        // 简单的作者分割（按逗号和 "and" 分割）
        const authors = authorText
            .split(/,|\sand\s/)
            .map(author => author.trim())
            .filter(author => author.length > 0 && author.length < 50) // 过滤异常长的"作者"
            .slice(0, 10); // 限制作者数量

        if (authors.length > 0) {
            result.authors = authors;
        }
    }

    // 📚 期刊/会议信息提取（简单模式）
    const journalPatterns = [
        /In\s+([^,]+),/i,
        /\.\s*([A-Z][^.]+)\s*,\s*(?:19|20)\d{2}/,
        /\.\s*([A-Z][^.]+)\s*\.\s*(?:19|20)\d{2}/,
        // 新增：arXiv 格式
        /(arXiv preprint arXiv:[0-9]{4}\.[0-9]{4,5})/i
    ];

    for (const pattern of journalPatterns) {
        const journalMatch = reference.match(pattern);
        if (journalMatch && journalMatch[1]) {
            result.journal = journalMatch[1].trim();
            break;
        }
    }

    return result;
}

// 执行测试
console.log('🚀 测试分隔符修复效果');
console.log('原始数据长度:', problemData.length);

// 第一阶段：智能拆分
const entries = smartSplitReferences(problemData);
console.log('\n📊 拆分结果:');
console.log('拆分后条目数量:', entries.length);

// 显示每个拆分的条目
entries.forEach((entry, index) => {
    console.log(`\n--- 条目 ${index + 1} ---`);
    console.log('长度:', entry.length);
    console.log('前100字符:', entry.substring(0, 100) + '...');
});

// 第二阶段：逐条解析
const parsedEntries = entries.map((entryText, index) => {
    const parsed = parseReferenceEntry(entryText);
    return {
        index: index + 1,
        raw: entryText,
        ...parsed
    };
});

console.log('\n🎯 解析结果 (重点关注标题和年份):');
parsedEntries.forEach((entry, index) => {
    console.log(`\n引文 ${index + 1}:`);
    console.log('  标题:', entry.title || '未识别');
    console.log('  年份:', entry.year || '未识别');
    console.log('  作者:', entry.authors ? entry.authors.join(', ') : '未识别');
    console.log('  arXiv ID:', entry.arxivId || '无');
    console.log('  URL:', entry.url || '无');
});

console.log('\n✅ 测试完成!'); 