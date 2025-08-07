import React from 'react';

interface QualiaHeaderProps {
  className?: string;
}

export function QualiaHeader({ className = '' }: QualiaHeaderProps) {
  return (
    <header className={`bg-white border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - App title */}
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Document Processor
            </h1>
          </div>

          {/* Right side - Qualia Solutions branding */}
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600 font-medium">
              Made by
            </span>
            <div className="flex items-center space-x-2">
              <img 
                src="/qualia-logo.png" 
                alt="Qualia Solutions" 
                className="h-8 w-auto"
                onError={(e) => {
                  // Fallback if logo fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-lg font-bold text-blue-600">
                Qualia Solutions
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}