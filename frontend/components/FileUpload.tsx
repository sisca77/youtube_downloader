'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileVideo, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

const ACCEPTED_FORMATS = {
  'video/mp4': ['.mp4'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/x-m4a': ['.m4a'],
  'video/webm': ['.webm'],
};

export default function FileUpload({ onFileSelect, isUploading }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      // 형식이 잘못된 파일이 있으면 처리하지 않음
      return;
    }
    
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isDragActive ? (
            <>
              <FileVideo className="w-12 h-12 text-blue-500" />
              <p className="text-lg font-medium text-blue-700">파일을 여기에 놓으세요</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-700">
                  영상 파일을 드래그하거나 클릭하여 선택하세요
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  지원 형식: MP4, MP3, WAV, M4A, WebM
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  대용량 파일은 자동으로 분할 처리됩니다
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">파일을 업로드할 수 없습니다:</p>
              <ul className="mt-1 list-disc list-inside">
                {fileRejections.map((rejection, index) => {
                  const error = rejection.errors[0];
                  let errorMessage = '알 수 없는 오류';
                  
                  if (error?.code === 'file-too-large') {
                    const sizeMB = (rejection.file.size / 1024 / 1024).toFixed(2);
                    errorMessage = `파일 크기 초과 (${sizeMB}MB / 최대 25MB)`;
                  } else if (error?.code === 'file-invalid-type') {
                    errorMessage = '지원하지 않는 파일 형식';
                  } else if (error?.message) {
                    errorMessage = error.message;
                  }
                  
                  return (
                    <li key={index}>
                      {rejection.file.name} - {errorMessage}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
