/**
 * 🌳 TreeVisualization 配置文件
 * 
 * 🎯 统一管理树形可视化的所有配置参数：
 * - 物理效果开关和参数
 * - 连线类型和样式
 * - 层高度和缩放响应
 * - 节点尺寸和布局
 */

// 连线类型定义
export type EdgeType = 'smoothstep' | 'step' | 'straight';

// 缩放级别定义
export type ZoomLevel = 'detailed' | 'simplified';

// 物理效果配置
export const PHYSICS_CONFIG = {
  // 是否默认启用物理效果
  ENABLED_BY_DEFAULT: true,
  
  // 基础物理参数
  BASE: {
    LINK_DISTANCE: 150,        // 父子节点间距离
    LINK_STRENGTH: 0.8,        // 连接强度
    CHARGE_STRENGTH: -400,     // 节点排斥力
    COLLISION_RADIUS: 400,     // 节点碰撞半径
    LAYER_SEPARATION: 300,     // 层间垂直距离（详细模式）- 从500减小到300
    LAYER_SEPARATION_SIMPLIFIED: 100,  // 层间垂直距离（简化模式）- 从45适度增加到65
    SIBLING_SPACING: 120,      // 同层节点间距（详细模式）- 从180减小到120
    SIBLING_SPACING_SIMPLIFIED: 50,   // 同层节点间距（简化模式）- 从35适度增加到50
  },

  // 层级约束参数
  CONSTRAINTS: {
    VERTICAL_STRENGTH: 0.8,    // 垂直层级约束强度（增强网格吸引力）
    HORIZONTAL_STRENGTH: 0.01,  // 水平分布约束强度
    ROOT_ANCHOR_STRENGTH: 0.5, // 根节点锚定强度
  },

  // 动画参数
  ANIMATION: {
    ALPHA_TARGET: 0.1,         // 目标alpha值
    ALPHA_MIN: 0.005,          // 最小alpha值
    ALPHA_DECAY: 0.01,         // alpha衰减率
    VELOCITY_DECAY: 0.3,       // 速度衰减率
  },

  // 自动层高度控制
  AUTO_LAYER_HEIGHT: {
    ENABLED: true,             // 是否启用自动层高度
    ZOOM_THRESHOLD: 0.7,       // 缩放阈值
    TRANSITION_DURATION: 500,  // 过渡动画时长(ms)
  }
};

// 可视化配置
export const VISUALIZATION_CONFIG = {
  // 默认连线类型
  DEFAULT_EDGE_TYPE: 'default' as EdgeType,
  
  // 缩放配置
  ZOOM: {
    THRESHOLD: 0.7,            // 两级缩放阈值
    MIN: 0.1,                  // 最小缩放
    MAX: 2.0,                  // 最大缩放
    DEFAULT: 1.0,              // 默认缩放
  },

  // 节点配置
  NODE: {
    // 详细模式尺寸
    DETAILED: {
      MIN_WIDTH: 240,
      MAX_WIDTH: 450,
      BASE_WIDTH: 280,
      MIN_HEIGHT: 144,
    },
    
    // 简化模式尺寸
    SIMPLIFIED: {
      WIDTH: 80,
      HEIGHT: 32,
    },

    // 动态宽度计算参数
    WIDTH_CALCULATION: {
      TITLE_LENGTH_THRESHOLDS: {
        VERY_LONG: 80,    // > 80字符 -> 420px
        LONG: 60,         // > 60字符 -> 380px
        MEDIUM: 40,       // > 40字符 -> 340px
        SHORT: 20,        // > 20字符 -> 300px
      },
      AUTHOR_BONUS: {
        MANY_AUTHORS: 4,  // > 4作者 -> +30px
        SOME_AUTHORS: 2,  // > 2作者 -> +15px
      },
      STATS_MIN_WIDTH: 360, // 有统计信息时的最小宽度
    }
  },

  // 连线配置
  EDGE: {
    STYLES: {
      smoothstep: {
        strokeWidth: 2,
        stroke: '#64748b',
        markerEnd: { type: 'ArrowClosed', width: 20, height: 20 }
      },
      step: {
        strokeWidth: 2,
        stroke: '#64748b',
        markerEnd: { type: 'ArrowClosed', width: 20, height: 20 }
      },
      straight: {
        strokeWidth: 2,
        stroke: '#64748b',
        markerEnd: { type: 'ArrowClosed', width: 20, height: 20 }
      }
    },
    
    // 连接线样式（拖拽时）
    CONNECTION_LINE: {
      strokeWidth: 2,
      stroke: '#3b82f6',
    }
  },

  // 布局配置
  LAYOUT: {
    // Dagre布局参数
    DAGRE: {
      rankdir: 'TB',
      ranksep: 100,
      nodesep: 80,
    },
    
    // 容器配置
    CONTAINER: {
      DEFAULT_WIDTH: 800,
      DEFAULT_HEIGHT: 600,
      PADDING: 0.2,
    }
  },

  // 交互配置
  INTERACTION: {
    // 拖拽配置
    DRAG: {
      NODES_DRAGGABLE: true,
      PAN_ON_DRAG: [1, 2], // 中键和右键拖拽画布
      PAN_ON_SCROLL: false,
    },
    
    // 缩放配置
    ZOOM: {
      ON_SCROLL: true,
      ON_PINCH: true,
      ON_DOUBLE_CLICK: true,
      ACTIVATION_KEY: null, // 无需按键激活
    },
    
    // 选择配置
    SELECTION: {
      ELEMENTS_SELECTABLE: true,
      MULTI_SELECTION_KEY: 'Meta', // Cmd/Ctrl键多选
    }
  }
};

// 主题配置
export const THEME_CONFIG = {
  // 节点主题
  NODE: {
    DETAILED: {
      BACKGROUND: 'bg-white',
      BORDER: 'border-2',
      BORDER_RADIUS: 'rounded-lg',
      SHADOW: 'shadow-md',
      PADDING: 'p-4',
      
      // 状态样式
      SELECTED: 'border-blue-500 shadow-lg',
      DEFAULT: 'border-gray-200',
      HOVER: 'hover:border-blue-300',
    },
    
    SIMPLIFIED: {
      BACKGROUND: 'bg-gradient-to-br from-blue-400 to-indigo-500',
      SELECTED: 'from-blue-600 to-indigo-700 ring-2 ring-blue-300',
      HOVER: 'hover:from-blue-500 hover:to-indigo-600',
      TEXT: 'text-white text-sm font-mono',
    }
  },

  // Handle主题
  HANDLE: {
    SIZE: 'w-3 h-3',
    COLOR: 'bg-blue-500',
    BORDER: 'border-2 border-white',
    VISIBILITY: 'opacity-0 hover:opacity-100',
    TRANSITION: 'transition-opacity',
  },

  // 工具栏主题
  TOOLBAR: {
    BACKGROUND: 'bg-gray-50',
    BORDER_RADIUS: 'rounded-lg',
    PADDING: 'p-3',
    GAP: 'gap-4',
  }
};

// 开发配置
export const DEV_CONFIG = {
  // 是否启用调试模式
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  
  // 是否显示物理引擎调试信息
  SHOW_PHYSICS_DEBUG: false,
  
  // 是否在控制台输出性能信息
  SHOW_PERFORMANCE_LOGS: false,
  
  // 是否启用实验性功能
  EXPERIMENTAL_FEATURES: {
    ADVANCED_PHYSICS: true,
    DYNAMIC_LAYOUT: true,
    SMART_POSITIONING: true,
  }
};

// 导出所有配置的合并对象
export const TREE_VISUALIZATION_CONFIG = {
  PHYSICS: PHYSICS_CONFIG,
  VISUALIZATION: VISUALIZATION_CONFIG,
  THEME: THEME_CONFIG,
  DEV: DEV_CONFIG,
} as const;

// 类型导出
export type TreeVisualizationConfig = typeof TREE_VISUALIZATION_CONFIG;

// 配置验证函数
export function validateConfig(config: Partial<TreeVisualizationConfig>): boolean {
  try {
    // 基础验证
    if (config.PHYSICS?.BASE?.LINK_DISTANCE && config.PHYSICS.BASE.LINK_DISTANCE <= 0) {
      console.warn('Invalid LINK_DISTANCE: must be positive');
      return false;
    }
    
    if (config.VISUALIZATION?.ZOOM?.THRESHOLD && 
        (config.VISUALIZATION.ZOOM.THRESHOLD <= 0 || config.VISUALIZATION.ZOOM.THRESHOLD >= 1)) {
      console.warn('Invalid ZOOM_THRESHOLD: must be between 0 and 1');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Config validation error:', error);
    return false;
  }
}

// 获取当前配置的辅助函数
export function getCurrentConfig(): TreeVisualizationConfig {
  return TREE_VISUALIZATION_CONFIG;
}

// 根据缩放级别获取物理参数的辅助函数
export function getPhysicsParamsForZoom(zoomLevel: ZoomLevel) {
  const base = PHYSICS_CONFIG.BASE;
  
  if (zoomLevel === 'simplified') {
    return {
      ...base,
      LAYER_SEPARATION: base.LAYER_SEPARATION_SIMPLIFIED,
      SIBLING_SPACING: base.SIBLING_SPACING_SIMPLIFIED,
    };
  }
  
  return base;
}
