"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLibraryStore } from "@/store/libraryStore";
import { TreePine } from "lucide-react";

export default function SelectTestPage() {
  const [selectedValue, setSelectedValue] = useState<string>("");
  const { trees, initialize } = useLibraryStore();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Select组件测试页面</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>基础Select测试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">简单Select测试:</label>
            <Select value={selectedValue} onValueChange={setSelectedValue}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="选择一个选项..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">选项 1</SelectItem>
                <SelectItem value="option2">选项 2</SelectItem>
                <SelectItem value="option3">选项 3</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600 mt-2">当前选中: {selectedValue || '无'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>树选择器测试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Button onClick={initialize} className="mb-4">
              刷新数据
            </Button>
            
            <div className="text-sm text-gray-600 mb-2">
              可用树数量: {trees.length}
            </div>
            
            <div className="flex items-center gap-2">
              <TreePine className="h-4 w-4 text-green-600" />
              <Select value="" onValueChange={(value) => console.log('选中:', value)}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="选择一个文献树..." />
                </SelectTrigger>
                <SelectContent>
                  {trees.length === 0 ? (
                    <SelectItem value="no-trees" disabled>
                      <span className="text-gray-500">暂无可用的文献树</span>
                    </SelectItem>
                  ) : (
                    trees.map((tree) => (
                      <SelectItem key={tree.id} value={tree.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{tree.name}</span>
                          <span className="text-xs text-gray-500">
                            {Object.keys(tree.nodes).length} 个节点
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>调试信息</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify({ 
              treesCount: trees.length,
              trees: trees.map(t => ({ id: t.id, name: t.name, nodeCount: Object.keys(t.nodes).length }))
            }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
