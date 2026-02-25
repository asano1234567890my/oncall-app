// src/app/page.tsx
"use client";

import { useState } from "react";

export default function DashboardPage() {
  const [apiResponse, setApiResponse] = useState<string>("まだ通信していません");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const testConnection = async () => {
    setIsLoading(true);
    setApiResponse("通信中...");
    
    try {
      // バックエンドの /health エンドポイントを叩く
      const response = await fetch("http://127.0.0.1:8000/health");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      // 取得したJSONデータを整形して表示
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("API Error:", error);
      setApiResponse("接続失敗: バックエンドが起動しているか確認してください。CORSエラーの可能性もあります。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <main className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">
          当直表最適化システム
        </h1>

        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">API連携テスト (CORS確認)</h2>
          <p className="text-gray-600 mb-4 text-sm">
            下のボタンを押すと、FastAPIバックエンド (http://127.0.0.1:8000) と通信します。
          </p>
          
          <button
            onClick={testConnection}
            disabled={isLoading}
            className={`px-6 py-2 rounded font-bold text-white transition ${
              isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isLoading ? "通信中..." : "バックエンドと通信する"}
          </button>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-gray-700 mb-2">レスポンス結果:</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto text-sm font-mono min-h-[100px]">
              {apiResponse}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}