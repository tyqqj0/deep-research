# Git 分支管理工作流程

## 🚀 快速实验分支
```bash
# 创建实验分支（用于快速验证想法）
git checkout dev
git pull origin dev
git checkout -b experiment/test-new-idea

# 快速提交实验代码
git add .
git commit -m "experiment: 测试新想法"

# 验证成功 -> 转为正式功能分支
git checkout dev
git checkout -b feature/confirmed-feature
git merge experiment/test-new-idea

# 验证失败 -> 直接删除
git checkout dev
git branch -D experiment/test-new-idea
```

## 🔧 功能开发分支
```bash
# 创建功能分支
git checkout dev
git checkout -b feature/floating-menu-v2

# 定期同步dev分支的更新
git checkout dev
git pull origin dev
git checkout feature/floating-menu-v2
git merge dev

# 功能完成后合并
git checkout dev
git merge feature/floating-menu-v2
git branch -d feature/floating-menu-v2
```

## 🔥 紧急修复分支
```bash
# 从main创建hotfix分支
git checkout main
git checkout -b hotfix/critical-bug

# 修复完成后同时合并到main和dev
git checkout main
git merge hotfix/critical-bug
git checkout dev
git merge hotfix/critical-bug
git branch -d hotfix/critical-bug
```

## 📦 发布分支
```bash
# 创建发布分支
git checkout dev
git checkout -b release/v1.2.0

# 发布后合并到main并打标签
git checkout main
git merge release/v1.2.0
git tag -a v1.2.0 -m "版本 1.2.0"
git push origin main --tags
```

## 🔄 常用回退操作
```bash
# 撤销最后一次提交（保留文件修改）
git reset --soft HEAD~1

# 撤销最后一次提交（不保留文件修改）
git reset --hard HEAD~1

# 撤销到特定提交
git reset --hard <commit-hash>

# 创建反向提交（推荐用于已推送的提交）
git revert <commit-hash>

# 暂存当前修改
git stash
git stash pop  # 恢复暂存
```

## 🧪 实验性功能开发建议

### 方案1: 实验分支模式
- `experiment/功能名` - 用于快速验证
- 验证成功转为 `feature/功能名`
- 验证失败直接删除

### 方案2: 提交标记模式
```bash
# 在功能分支中标记实验性提交
git commit -m "experiment: 尝试新的UI布局"
git commit -m "wip: 半成品代码，需要重构"
git commit -m "feat: 确认可行的新功能"

# 需要时使用rebase清理提交历史
git rebase -i HEAD~3
```

### 方案3: 分层验证模式
```bash
# 层级1: 快速原型验证
experiment/prototype-xxx

# 层级2: 功能开发
feature/xxx

# 层级3: 集成测试
dev

# 层级4: 稳定发布
main
``` 