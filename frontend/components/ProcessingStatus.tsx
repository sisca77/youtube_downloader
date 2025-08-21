'use client';

import React from 'react';
import { Loader2, CheckCircle, XCircle, FileText, ListOrdered } from 'lucide-react';
import { ProcessingStatus as ProcessingStatusType } from '@/types';

interface ProcessingStatusProps {
  status: ProcessingStatusType;
}

export default function ProcessingStatus({ status }: ProcessingStatusProps) {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'processing':
      case 'splitting_file':
      case 'extracting_transcript':
      case 'generating_outline':
        return <Loader2 className="w-8 h-8 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'failed':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'processing':
      case 'splitting_file':
      case 'extracting_transcript':
      case 'generating_outline':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${getStatusColor()}`}>
      <div className="flex items-center space-x-4">
        {getStatusIcon()}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{status.message}</h3>
          
          {/* Progress Bar */}
          {status.status !== 'completed' && status.status !== 'failed' && (
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>진행률</span>
                <span>{status.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {status.status === 'failed' && status.error && (
            <p className="mt-2 text-sm text-red-600">{status.error}</p>
          )}
        </div>
      </div>

      {/* Results */}
      {status.status === 'completed' && (status.transcript || status.outline) && (
        <div className="mt-6 space-y-6">
          {status.transcript && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">트랜스크립트</h4>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{status.transcript}</p>
              </div>
            </div>
          )}

          {status.outline && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-3">
                <ListOrdered className="w-5 h-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">아웃라인</h4>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{status.outline}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
