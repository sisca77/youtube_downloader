'use client';

import { useState } from 'react';
import { FileText, BookOpen, Lightbulb } from 'lucide-react';

interface ResultTabsProps {
  transcript?: string;
  outline?: string;
  detailedExplanation?: string;
}

export default function ResultTabs({
  transcript,
  outline,
  detailedExplanation,
}: ResultTabsProps) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'outline' | 'explanation'>('outline');

  const tabs = [
    {
      id: 'transcript',
      label: '원본 스크립트',
      icon: FileText,
      content: transcript,
    },
    {
      id: 'outline',
      label: '요약 아웃라인',
      icon: BookOpen,
      content: outline,
    },
    {
      id: 'explanation',
      label: 'AI 해설',
      icon: Lightbulb,
      content: detailedExplanation,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex-1 px-4 py-3 flex items-center justify-center space-x-2
                transition-colors font-medium text-sm
                ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={activeTab === tab.id ? 'block' : 'hidden'}
          >
            {tab.content ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                  {tab.content}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <tab.icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>콘텐츠를 불러오는 중입니다...</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
