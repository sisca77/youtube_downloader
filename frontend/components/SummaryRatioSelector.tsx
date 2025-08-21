'use client';

import React from 'react';

interface SummaryRatioSelectorProps {
  value: number;
  onChange: (ratio: number) => void;
  disabled?: boolean;
}

const ratioOptions = [
  { value: 0.3, label: '30%', description: '핵심만 간략히' },
  { value: 0.5, label: '50%', description: '균형잡힌 요약' },
  { value: 0.7, label: '70%', description: '상세한 요약' },
];

export default function SummaryRatioSelector({ 
  value, 
  onChange, 
  disabled = false 
}: SummaryRatioSelectorProps) {
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-gray-700 mb-3">요약 비율 선택</h3>
      <div className="grid grid-cols-3 gap-3">
        {ratioOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`
              relative p-4 rounded-lg border-2 transition-all
              ${value === option.value 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="font-semibold text-lg">{option.label}</div>
            <div className="text-xs mt-1 opacity-75">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
