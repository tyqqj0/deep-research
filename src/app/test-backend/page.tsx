"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

// 动态导入测试函数
import { 
  testDoiSubmission, 
  testUrlSubmission, 
  testAutoSync, 
  testPdfUpload, 
  testErrorHandling, 
  runAllTests 
} from '@/libs/backend/test-backend-api';

export default function TestBackendPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // 拦截console.log来显示在页面上
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `[LOG] ${new Date().toLocaleTimeString()}: ${message}`]);
      originalLog(...args);
    };

    console.error = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `[ERROR] ${new Date().toLocaleTimeString()}: ${message}`]);
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  const runTest = async (testFn: () => Promise<void>, testName: string) => {
    setIsRunning(true);
    setLogs(prev => [...prev, `\n🚀 Starting ${testName}...`]);
    
    try {
      await testFn();
      setLogs(prev => [...prev, `✅ ${testName} completed\n`]);
    } catch (error) {
      setLogs(prev => [...prev, `❌ ${testName} failed: ${error}\n`]);
    } finally {
      setIsRunning(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">后端API测试页面</h1>
        <p className="text-gray-600">
          测试后端文献解析服务的各种功能。确保后端服务运行在 
          <Badge variant="outline" className="mx-1">http://localhost:8000</Badge>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 测试控制面板 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>测试控制面板</CardTitle>
              <CardDescription>
                点击按钮运行各种测试，观察后端API的行为
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={() => runTest(testDoiSubmission, 'DOI提交测试')}
                disabled={isRunning}
                className="w-full"
              >
                🧪 测试DOI提交和轮询
              </Button>
              
              <Button 
                onClick={() => runTest(testUrlSubmission, 'URL提交测试')}
                disabled={isRunning}
                variant="outline"
                className="w-full"
              >
                🌐 测试URL提交
              </Button>
              
              <Button 
                onClick={() => runTest(testAutoSync, '自动同步测试')}
                disabled={isRunning}
                variant="outline"
                className="w-full"
              >
                🔄 测试自动状态同步
              </Button>
              
              <Button 
                onClick={() => runTest(testPdfUpload, 'PDF上传测试')}
                disabled={isRunning}
                variant="outline"
                className="w-full"
              >
                📄 测试PDF文件上传
              </Button>
              
              <Button 
                onClick={() => runTest(testErrorHandling, '错误处理测试')}
                disabled={isRunning}
                variant="outline"
                className="w-full"
              >
                ❌ 测试错误处理
              </Button>
              
              <div className="border-t pt-3">
                <Button 
                  onClick={() => runTest(runAllTests, '完整测试套件')}
                  disabled={isRunning}
                  variant="default"
                  className="w-full"
                >
                  🚀 运行所有测试
                </Button>
              </div>
              
              <Button 
                onClick={clearLogs}
                variant="ghost"
                className="w-full"
              >
                🗑️ 清空日志
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>测试说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div><strong>DOI测试:</strong> 使用经典论文DOI测试完整流程</div>
              <div><strong>URL测试:</strong> 使用arXiv链接测试URL处理</div>
              <div><strong>自动同步:</strong> 测试SyncService的轮询机制</div>
              <div><strong>PDF上传:</strong> 测试文件上传功能（可能失败）</div>
              <div><strong>错误处理:</strong> 测试各种错误情况的处理</div>
            </CardContent>
          </Card>
        </div>

        {/* 日志显示区域 */}
        <div>
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                测试日志
                <Badge variant={isRunning ? "default" : "secondary"}>
                  {isRunning ? "运行中..." : "就绪"}
                </Badge>
              </CardTitle>
              <CardDescription>
                实时显示测试执行过程和结果
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={logs.join('\n')}
                readOnly
                className="h-[480px] font-mono text-sm resize-none"
                placeholder="测试日志将在这里显示..."
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 快速操作提示 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>控制台快速操作</CardTitle>
          <CardDescription>
            你也可以在浏览器控制台中直接运行测试
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md font-mono text-sm">
            <div>// 在控制台中运行:</div>
            <div className="text-blue-600">window.backendTests.testDoiSubmission()</div>
            <div className="text-blue-600">window.backendTests.runAllTests()</div>
            <div className="text-blue-600">window.backendTests.backendService.getTaskStatus('task-id')</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
