import React from 'react';
import { Upload, Brain, Eye, FileText, Download } from 'lucide-react';
import { ProcessingStep } from '@/types';

interface StepIndicatorProps {
  currentStep: ProcessingStep;
  className?: string;
}

const steps = [
  { id: 'upload', label: 'Upload Documents', icon: Upload, description: 'Drag & drop or select files' },
  { id: 'processing', label: 'Processing', icon: Brain, description: 'Extract data automatically' },
  { id: 'review', label: 'Review & Edit', icon: Eye, description: 'Verify extracted information' },
  { id: 'form', label: 'Generate Form', icon: FileText, description: 'Create professional forms' },
  { id: 'export', label: 'Export', icon: Download, description: 'Download PDF, DOCX, Excel' }
];

export function StepIndicator({ currentStep, className = '' }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        />
        
        {/* Steps */}
        {steps.map((step, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = step.id === currentStep;
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 bg-white">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${isActive 
                  ? 'bg-blue-500 border-blue-500 text-white shadow-lg' 
                  : 'bg-gray-100 border-gray-300 text-gray-400'
                }
                ${isCurrent ? 'scale-110 shadow-xl' : ''}
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="mt-3 text-center max-w-[120px]">
                <h3 className={`text-sm font-medium ${
                  isActive ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {step.label}
                </h3>
                <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}