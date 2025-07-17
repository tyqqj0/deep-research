# 文献解析后端服务 - API 使用指南 (v1.1)

欢迎使用文献解析后端服务！本指南将帮助您理解并有效利用API来处理文献、监控进度并获取最终的结构化数据。

## 核心理念：异步处理

本API的核心设计是**异步处理**。您不会在提交文献后立即得到完整结果，因为解析一篇文献（特别是下载和处理PDF）可能需要较长时间。

取而代之的工作流程是：

1.  **提交任务**：您向API提交一个文献源（如DOI或PDF链接）。
2.  **获取任务ID**：API会立即返回一个 `taskId`，确认任务已接收。
3.  **轮询状态**：您使用这个 `taskId` 定期查询任务的执行状态。
4.  **获取结果**：当任务状态显示为 `success` 或 `partial_success` 时，您就可以根据返回的 `literature_id` 获取最终的文献数据。

---

## 工作流程详解

### 第1步：提交一篇新文献

通过向 `/literatures` 端点发送 `POST` 请求来启动一个新的解析任务。您至少需要提供文献的DOI、URL或PDF链接之一。

**Endpoint**: `POST /api/v1/literatures`

**请求示例**:
```json
{
  "source": {
    "doi": "10.1109/CVPR.2017.695"
  }
}
```
*或者，使用URL:*
```json
{
  "source": {
    "url": "https://arxiv.org/abs/1706.03762"
  }
}
```

**成功响应 (HTTP `202 Accepted`)**:
服务器会立即响应，告诉你任务已创建。

```json
{
  "taskId": "a8c5b9f0-6b7e-4f5a-9d2c-1e8b9f3a6c2d",
  "status_url": "/api/v1/tasks/a8c5b9f0-6b7e-4f5a-9d2c-1e8b9f3a6c2d"
}
```
**请务必保存好这个 `taskId`**，它是您跟踪进度的唯一凭证。

> **✨ 智能重试机制**：如果您提交的文献之前处理失败过，系统会自动清理掉旧的失败记录，并用您这次提交的信息重新开始一个新的处理流程。您无需担心重复提交失败的任务。

### 第2步：轮询任务状态

获取到 `taskId` 后，您需要定期（例如每隔2-3秒）向任务状态端点发起 `GET` 请求，以获取实时的处理进度。

**Endpoint**: `GET /api/v1/tasks/{taskId}`

**返回的数据结构极其丰富，是前端展示进度的核心**。它包含一个 `overall_status` 和一个详细的 `components` 对象。

#### 解读任务状态

*   `overall_status`: 任务的总体状态。
    *   `processing`: 任务正在处理中。
    *   `success`: 所有关键组件（元数据、内容、参考文献）都成功处理。
    *   `partial_success`: 部分关键组件成功，部分失败。文献数据可能不完整，但可用。
    *   `failed`: 所有关键组件都处理失败。
*   `components`: 一个对象，包含 `metadata`, `content`, `references` 三个子任务的详细状态。

#### 组件状态 (`components` 内的每个对象)

每个组件都有以下字段：
*   `status`: 该组件的状态 (`pending`, `processing`, `success`, `failed`, `waiting`)。
*   `stage`: 人类可读的当前处理阶段描述 (例如, "正在从CrossRef获取元数据")。
*   `progress`: 该组件的完成百分比 (0-100)。
*   `source`: 如果成功，数据来源于哪里 (例如, "Semantic Scholar API")。
*   `next_action`: 对用户的下一步操作建议 (例如, "可尝试手动上传PDF文件")。
*   `error_info`: 如果失败，会包含详细的错误信息。

**轮询响应示例：处理中**
```json
// GET /api/v1/tasks/a8c5b9f0-...
{
  "task_id": "a8c5b9f0-...",
  "overall_status": "processing",
  "components": {
    "metadata": {
      "status": "success",
      "stage": "元数据获取成功",
      "progress": 100,
      //...
    },
    "content": {
      "status": "processing",
      "stage": "正在下载PDF文件",
      "progress": 50,
      //...
    },
    "references": {
      "status": "waiting", // 正在等待 'content' 任务完成
      "stage": "等待依赖完成",
      "progress": 0,
      //...
    }
  }
}
```

**轮询响应示例：任务失败**
```json
// GET /api/v1/tasks/a8c5b9f0-...
{
  "task_id": "a8c5b9f0-...",
  "overall_status": "failed",
  "error_info": { "error_message": "所有关键组件处理失败" },
  "components": {
    "metadata": {
      "status": "failed",
      "error_info": { "error_message": "无法从任何来源找到元数据" },
      //...
    },
    "content": {
      "status": "failed",
      "error_info": { "error_message": "PDF下载链接无效" },
      //...
    },
    //...
  }
}
```
**您应该持续轮询，直到 `overall_status` 不再是 `processing` 为止。**

### 第3步：获取最终的文献数据

当轮询结果中的 `overall_status` 变为 `success` 或 `partial_success` 时，您会同时获得 `literature_id` 和 `resource_url`。

**Endpoint**: `GET /api/v1/literatures/{literatureId}`

**请求示例**:
使用上一步中获取的 `literature_id`: `lit_c4d2e8f1`。
`GET /api/v1/literatures/lit_c4d2e8f1`

**成功响应 (HTTP `200 OK`)**:
您将得到完整、结构化的文献数据。

```json
{
  "id": "lit_c4d2e8f1",
  "identifiers": {
    "doi": "10.1109/CVPR.2017.695",
    "arxiv_id": null
  },
  "metadata": {
    "title": "Mask R-CNN",
    "authors": [
      { "name": "Kaiming He" },
      { "name": "Georgia Gkioxari" }
    ],
    "year": 2017,
    "journal": "2017 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)"
  },
  "content": {
    "pdf_url": "http://openaccess.thecvf.com/content_cvpr_2017/papers/He_Mask_R-CNN_CVPR_2017_paper.pdf",
    "source_page_url": null,
    // ...
  },
  "references": [
    {
      "raw_text": "...",
      "parsed": { "title": "...", "year": 2016 },
      "source": "Semantic Scholar API"
    }
    // ... 更多参考文献
  ],
  "task_info": {
    // 这里会包含任务处理的最终快照
  }
}
```
现在，您可以将这些数据显示在您的应用界面中了。

---

## 总结

与本API交互的生命周期非常清晰：
1.  **`POST /literatures`** -> 获得 `taskId`
2.  **`GET /tasks/{taskId}`** (循环) -> 监控 `overall_status` 和 `components`
3.  **`GET /literatures/{literatureId}`** -> 在任务成功后，获取最终数据

祝您使用愉快！ 