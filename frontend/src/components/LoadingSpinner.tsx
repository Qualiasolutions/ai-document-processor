import React from 'react';
import { Brain } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({ message = 'Processing...', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4 text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Processing Document
        </h3>
        <p className="text-gray-600">
          {message}
        </p>
      </div>
    </div>
  );
}