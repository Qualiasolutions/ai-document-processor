import React from 'react';

interface ProgressBarProps {
  progress: number;
  text?: string;
  className?: string;
}

export function ProgressBar({ progress, text, className = '' }: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-2">
        {text && <span className="text-sm text-gray-600">{text}</span>}
        <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}