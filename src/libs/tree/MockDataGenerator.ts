/**
 * 🎭 MockDataGenerator - 模拟数据生成器
 * 
 * 🎯 核心功能:
 * - 基于真实经典AI论文创建模拟文献数据
 * - 构建有意义的树形结构展示论文发展脉络
 * - 为演示提供丰富的MCTS节点数据
 * 
 * 📚 经典论文选择:
 * - Transformer系列: Attention Is All You Need → GPT → BERT → GPT-2/3
 * - RNN/LSTM系列: RNN → LSTM → GRU → Attention
 * - CNN系列: LeNet → AlexNet → ResNet → Vision Transformer
 */

import { LibraryItem, LiteratureTree, MCTSNode } from '@/libs/db';
import { libraryService } from '@/libs/db/LibraryService';
import { treeService } from './TreeService';
import { generateLibraryItemId, generateTreeId, generateNodeId } from '../utils/uuid';

// 经典AI论文数据
const CLASSIC_AI_PAPERS = [
  // Transformer系列
  {
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
    year: 2017,
    publication: "Advances in Neural Information Processing Systems",
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    doi: "10.48550/arXiv.1706.03762",
    category: "transformer"
  },
  {
    title: "Improving Language Understanding by Generative Pre-Training",
    authors: ["Alec Radford", "Karthik Narasimhan", "Tim Salimans", "Ilya Sutskever"],
    year: 2018,
    publication: "OpenAI Technical Report",
    abstract: "Natural language understanding comprises a wide range of diverse tasks such as textual entailment, question answering, semantic similarity assessment, and document classification. Although large unlabeled text corpora are abundant, labeled data for learning these specific tasks is scarce, making it challenging for discriminatively trained models to perform adequately.",
    category: "transformer"
  },
  {
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
    year: 2018,
    publication: "arXiv preprint arXiv:1810.04805",
    abstract: "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
    doi: "10.48550/arXiv.1810.04805",
    category: "transformer"
  },
  {
    title: "Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann", "Nick Ryder", "Melanie Subbiah"],
    year: 2020,
    publication: "Advances in Neural Information Processing Systems",
    abstract: "Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text followed by fine-tuning on a specific task. While typically task-agnostic in architecture, this method still requires task-specific fine-tuning datasets of thousands or tens of thousands of examples.",
    doi: "10.48550/arXiv.2005.14165",
    category: "transformer"
  },
  
  // RNN/LSTM系列
  {
    title: "Long Short-Term Memory",
    authors: ["Sepp Hochreiter", "Jürgen Schmidhuber"],
    year: 1997,
    publication: "Neural Computation",
    abstract: "Learning to store information over extended time intervals by recurrent backpropagation takes a very long time, mostly because of insufficient, decaying error backflow. We briefly review Hochreiter's (1991) analysis of this problem, then address it with a novel, efficient, gradient based method called long short-term memory (LSTM).",
    doi: "10.1162/neco.1997.9.8.1735",
    category: "rnn"
  },
  {
    title: "Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation",
    authors: ["Kyunghyun Cho", "Bart van Merrienboer", "Caglar Gulcehre", "Dzmitry Bahdanau"],
    year: 2014,
    publication: "Proceedings of the 2014 Conference on Empirical Methods in Natural Language Processing",
    abstract: "In this paper, we propose a novel neural network model called RNN Encoder-Decoder that consists of two recurrent neural networks (RNN). One RNN encodes a sequence of symbols into a fixed-length vector representation, and the other decodes the representation into another sequence of symbols.",
    doi: "10.3115/v1/D14-1179",
    category: "rnn"
  },
  {
    title: "Neural Machine Translation by Jointly Learning to Align and Translate",
    authors: ["Dzmitry Bahdanau", "Kyunghyun Cho", "Yoshua Bengio"],
    year: 2014,
    publication: "arXiv preprint arXiv:1409.0473",
    abstract: "Neural machine translation is a recently proposed approach to machine translation. Unlike the traditional statistical machine translation, the neural machine translation aims at building a single neural network that can be jointly tuned to maximize the translation performance.",
    doi: "10.48550/arXiv.1409.0473",
    category: "rnn"
  },
  
  // CNN系列
  {
    title: "ImageNet Classification with Deep Convolutional Neural Networks",
    authors: ["Alex Krizhevsky", "Ilya Sutskever", "Geoffrey E. Hinton"],
    year: 2012,
    publication: "Advances in Neural Information Processing Systems",
    abstract: "We trained a large, deep convolutional neural network to classify the 1.2 million high-resolution images in the ImageNet LSVRC-2010 contest into the 1000 different classes. On the test data, we achieved top-1 and top-5 error rates of 37.5% and 17.0% which is considerably better than the previous state-of-the-art.",
    category: "cnn"
  },
  {
    title: "Deep Residual Learning for Image Recognition",
    authors: ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
    year: 2016,
    publication: "Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition",
    abstract: "Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions.",
    doi: "10.1109/CVPR.2016.90",
    category: "cnn"
  },
  {
    title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale",
    authors: ["Alexey Dosovitskiy", "Lucas Beyer", "Alexander Kolesnikov", "Dirk Weissenborn"],
    year: 2020,
    publication: "arXiv preprint arXiv:2010.11929",
    abstract: "While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited. In vision, attention is either applied in conjunction with convolutional networks, or used to replace certain components of convolutional networks while keeping their overall structure in place.",
    doi: "10.48550/arXiv.2010.11929",
    category: "vision_transformer"
  }
];

// 树结构定义：展示AI发展脉络
const TREE_STRUCTURES = {
  "transformer_evolution": {
    name: "Transformer架构演进树",
    description: "展示从Attention机制到现代大语言模型的发展脉络",
    root: "Attention Is All You Need",
    structure: {
      "Attention Is All You Need": [
        "Improving Language Understanding by Generative Pre-Training",
        "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding"
      ],
      "Improving Language Understanding by Generative Pre-Training": [
        "Language Models are Few-Shot Learners"
      ]
    }
  },
  "sequence_modeling": {
    name: "序列建模技术发展树",
    description: "从RNN到Transformer的序列建模技术演进",
    root: "Long Short-Term Memory",
    structure: {
      "Long Short-Term Memory": [
        "Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation",
        "Neural Machine Translation by Jointly Learning to Align and Translate"
      ],
      "Neural Machine Translation by Jointly Learning to Align and Translate": [
        "Attention Is All You Need"
      ]
    }
  },
  "vision_ai": {
    name: "计算机视觉AI发展树",
    description: "从CNN到Vision Transformer的视觉AI演进",
    root: "ImageNet Classification with Deep Convolutional Neural Networks",
    structure: {
      "ImageNet Classification with Deep Convolutional Neural Networks": [
        "Deep Residual Learning for Image Recognition"
      ],
      "Deep Residual Learning for Image Recognition": [
        "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale"
      ]
    }
  }
};

export class MockDataGenerator {
  /**
   * 生成所有经典论文的文献数据
   */
  async generateClassicPapers(): Promise<LibraryItem[]> {
    const papers: LibraryItem[] = [];
    
    for (const paperData of CLASSIC_AI_PAPERS) {
      const paper: LibraryItem = {
        id: generateLibraryItemId(),
        title: paperData.title,
        authors: paperData.authors,
        year: paperData.year,
        source: 'manual',
        publication: paperData.publication,
        abstract: paperData.abstract,
        doi: paperData.doi,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      papers.push(paper);
    }
    
    return papers;
  }

  /**
   * 将经典论文添加到文献库中
   */
  async addClassicPapersToLibrary(): Promise<{ [title: string]: string }> {
    const papers = await this.generateClassicPapers();
    const titleToIdMap: { [title: string]: string } = {};
    
    console.log('🎭 开始添加经典AI论文到文献库...');
    
    for (const paper of papers) {
      try {
        // 检查是否已存在
        const existingPapers = await libraryService.checkDuplicateByTitle(paper.title);
        
        if (existingPapers.length === 0) {
          const result = await libraryService.addLibraryItem(paper);
          if (result.success) {
            titleToIdMap[paper.title] = paper.id;
            console.log(`✅ 添加论文: ${paper.title}`);
          }
        } else {
          // 使用现有论文的ID
          titleToIdMap[paper.title] = existingPapers[0].id;
          console.log(`📋 论文已存在: ${paper.title}`);
        }
      } catch (error) {
        console.error(`❌ 添加论文失败: ${paper.title}`, error);
      }
    }
    
    console.log(`🎉 完成！共处理 ${Object.keys(titleToIdMap).length} 篇论文`);
    return titleToIdMap;
  }

  /**
   * 创建指定的树结构
   */
  async createTreeStructure(treeKey: keyof typeof TREE_STRUCTURES): Promise<LiteratureTree> {
    const treeConfig = TREE_STRUCTURES[treeKey];
    const titleToIdMap = await this.addClassicPapersToLibrary();
    
    console.log(`🌳 开始创建树结构: ${treeConfig.name}`);
    
    // 获取根节点对应的文献ID
    const rootItemId = titleToIdMap[treeConfig.root];
    if (!rootItemId) {
      throw new Error(`Root paper not found: ${treeConfig.root}`);
    }
    
    // 创建树
    const tree = await treeService.createTree(treeConfig.name, rootItemId);
    
    // 递归添加子节点
    await this.addChildNodes(tree.id, tree.rootNodeId, treeConfig.root, treeConfig.structure, titleToIdMap);
    
    // 为节点添加模拟的MCTS统计数据
    await this.addMockMCTSStats(tree.id);
    
    console.log(`✅ 树结构创建完成: ${treeConfig.name}`);
    return tree;
  }

  /**
   * 递归添加子节点
   */
  private async addChildNodes(
    treeId: string,
    parentNodeId: string,
    parentTitle: string,
    structure: any,
    titleToIdMap: { [title: string]: string }
  ): Promise<void> {
    const children = structure[parentTitle];
    if (!children || !Array.isArray(children)) return;
    
    for (const childTitle of children) {
      const childItemId = titleToIdMap[childTitle];
      if (!childItemId) {
        console.warn(`⚠️ 子节点论文未找到: ${childTitle}`);
        continue;
      }
      
      try {
        const childNode = await treeService.addNodeToTree(treeId, parentNodeId, childItemId);
        console.log(`  📎 添加子节点: ${childTitle}`);
        
        // 递归添加子节点的子节点
        await this.addChildNodes(treeId, childNode.id, childTitle, structure, titleToIdMap);
      } catch (error) {
        console.error(`❌ 添加子节点失败: ${childTitle}`, error);
      }
    }
  }

  /**
   * 为树节点添加模拟的MCTS统计数据
   */
  private async addMockMCTSStats(treeId: string): Promise<void> {
    const tree = await treeService.getTreeById(treeId);
    if (!tree) return;
    
    console.log('📊 添加模拟MCTS统计数据...');
    
    for (const node of Object.values(tree.nodes)) {
      // 根据节点在树中的位置生成合理的统计数据
      const depth = treeService.getPathToNode(tree, node.id).length;
      const childCount = treeService.getChildNodes(tree, node.id).length;
      
      // 模拟访问次数：根节点访问最多，深度越深访问越少
      const baseVisits = Math.max(100 - depth * 20, 10);
      const visits = baseVisits + Math.floor(Math.random() * 50);
      
      // 模拟胜率：有子节点的节点胜率稍高（表示扩展价值）
      const baseWinRate = 0.4 + (childCount > 0 ? 0.2 : 0) + Math.random() * 0.3;
      const wins = visits * baseWinRate;
      
      try {
        await treeService.updateNodeStats(treeId, node.id, visits, wins);
      } catch (error) {
        console.error(`❌ 更新节点统计失败: ${node.id}`, error);
      }
    }
    
    console.log('✅ MCTS统计数据添加完成');
  }

  /**
   * 创建所有预定义的树结构
   */
  async createAllTreeStructures(): Promise<LiteratureTree[]> {
    const trees: LiteratureTree[] = [];
    
    for (const treeKey of Object.keys(TREE_STRUCTURES) as Array<keyof typeof TREE_STRUCTURES>) {
      try {
        const tree = await this.createTreeStructure(treeKey);
        trees.push(tree);
      } catch (error) {
        console.error(`❌ 创建树结构失败: ${treeKey}`, error);
      }
    }
    
    return trees;
  }

  /**
   * 清理所有模拟数据
   */
  async cleanupMockData(): Promise<void> {
    console.log('🧹 开始清理模拟数据...');
    
    try {
      // 获取所有树
      const trees = await treeService.getAllTrees();
      
      // 删除所有树
      for (const tree of trees) {
        await treeService.deleteTree(tree.id);
        console.log(`🗑️ 删除树: ${tree.name}`);
      }
      
      console.log('✅ 模拟数据清理完成');
    } catch (error) {
      console.error('❌ 清理模拟数据失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const mockDataGenerator = new MockDataGenerator();
