"use client";

import React, { useState } from 'react';
import { 
  Users, 
  Settings2, 
  CalendarPlus, 
  UserPlus, 
  Trash2, 
  Stethoscope,
  ChevronRight
} from 'lucide-react';

// 初期データ：15名の医師（デモ用）
const INITIAL_DOCTORS = [
  "佐藤 健太郎", "鈴木 一郎", "高橋 怜奈", "田中 裕介", "伊藤 純子",
  "渡辺 徹", "山本 舞", "中村 昭夫", "小林 直樹", "加藤 恵子",
  "吉田 誠", "山田 花子", "佐々木 亮", "山口 智子", "松本 孝"
];

export default function OncallDashboard() {
  const [doctors, setDoctors] = useState<string[]>(INITIAL_DOCTORS);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // ルール設定の状態（MVP用）
  const [rules, setRules] = useState({
    fourDayInterval: true,
    noConsecutiveHolidays: true,
    saturdayLimit: true,
  });

  // 医師の追加
  const addDoctor = () => {
    if (newDoctorName.trim()) {
      setDoctors([...doctors, newDoctorName.trim()]);
      setNewDoctorName("");
    }
  };

  // 医師の削除
  const removeDoctor = (index: number) => {
    setDoctors(doctors.filter((_, i) => i !== index));
  };

  // 生成シミュレーション
  const handleGenerate = () => {
    setIsGenerating(true);
    // TODO: ここでバックエンド（FastAPI）の最適化エンジンを叩く
    setTimeout(() => {
      setIsGenerating(false);
      alert("当直表の生成リクエストを送信しました（MVP開発中）");
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        
        {/* ヘッダー */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <Stethoscope className="text-blue-600" />
              当直表最適化アシスタント
            </h1>
            <p className="text-slate-500 mt-2">内科部門：月間スケジュール作成</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            <span className="text-sm font-medium text-slate-600">対象医師: {doctors.length}名</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* 左カラム：医師名簿管理 */}
          <section className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Users size={18} /> 医師名簿
                </h2>
              </div>
              
              <div className="p-4">
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    value={newDoctorName}
                    onChange={(e) => setNewDoctorName(e.target.value)}
                    placeholder="新しい医師名を入力"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button 
                    onClick={addDoctor}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-1 text-sm transition-colors"
                  >
                    <UserPlus size={16} /> 追加
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {doctors.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                      <span className="text-slate-700 text-sm">{doc}</span>
                      <button 
                        onClick={() => removeDoctor(index)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 右カラム：ルール設定 ＆ 実行 */}
          <section className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
                <Settings2 size={18} /> 基本ルール設定
              </h2>
              
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={rules.fourDayInterval}
                    onChange={() => setRules({...rules, fourDayInterval: !rules.fourDayInterval})}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                    <strong>4日間隔ルール</strong><br/>
                    <span className="text-xs text-slate-400">当直後、最低4日は空ける</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={rules.saturdayLimit}
                    onChange={() => setRules({...rules, saturdayLimit: !rules.saturdayLimit})}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                    <strong>土曜当直制限</strong><br/>
                    <span className="text-xs text-slate-400">土曜当直は月1回まで</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={rules.noConsecutiveHolidays}
                    onChange={() => setRules({...rules, noConsecutiveHolidays: !rules.noConsecutiveHolidays})}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                    <strong>日祝兼務禁止</strong><br/>
                    <span className="text-xs text-slate-400">同一日の日直と当直を禁止</span>
                  </span>
                </label>
              </div>

              <div className="mt-8">
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || doctors.length === 0}
                  className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                    isGenerating 
                    ? "bg-slate-400 cursor-not-allowed" 
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95"
                  }`}
                >
                  {isGenerating ? (
                    <span className="animate-pulse">最適化中...</span>
                  ) : (
                    <>
                      当直表を自動生成する
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-3">
                  ※ Google OR-Toolsによる最適化エンジンが起動します
                </p>
              </div>
            </div>

            {/* ヒント */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs text-blue-700 leading-relaxed">
                💡 <strong>Tips:</strong> 医師名の横の削除ボタンでメンバーを調整できます。不可日の入力は次のステップで実施します。
              </p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}