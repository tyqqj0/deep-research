          )
        ) : (
          // 空状态显示
          <div className="h-[calc(100vh-180px)] flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-center text-gray-500 max-w-md">
              <TreePine className="h-16 w-16 mx-auto mb-4 text-green-400 opacity-60" />
              <h3 className="text-lg font-semibold mb-2 text-gray-700">二、文献研究</h3>
              <p className="text-sm mb-4">点击上方"开始文献播种"按钮启动工作流</p>
              <div className="space-y-2 text-xs text-gray-400">
                <p>🌱 播种模式：为研究主题创建初始文献库</p>
                <p>📚 将自动生成搜索任务，搜索并添加相关文献</p>
                <p>🔍 支持三面板布局：文献信息 + 树可视化 + MCTS控制</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}