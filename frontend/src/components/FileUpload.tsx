import React, { useCallback, useState } from 'react';
import { Upload, File, X, FileText, Image, Paperclip } from 'lucide-react';
import { validateFileType, formatFileSize, loadSampleDocuments, getSupportedFileTypes, getFileTypeInfo } from '@/lib/fileUtils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

export function FileUpload({ onFilesSelected, className = '' }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(file => {
      if (!validateFileType(file)) {
        console.warn(`File type not supported: ${file.type}`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        console.warn(`File too large: ${file.name}`);
        return false;
      }
      return true;
    });
    
    setSelectedFiles(validFiles);
    onFilesSelected(validFiles);
  }, [onFilesSelected]);

  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  }, [selectedFiles, onFilesSelected]);

  const handleLoadSamples = useCallback(async () => {
    setLoadingSamples(true);
    try {
      const sampleFiles = await loadSampleDocuments();
      setSelectedFiles(sampleFiles);
      onFilesSelected(sampleFiles);
    } catch (error) {
      console.error('Failed to load sample documents:', error);
    } finally {
      setLoadingSamples(false);
    }
  }, [onFilesSelected]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.includes('pdf')) return FileText;
    if (file.type.includes('word')) return FileText;
    return Paperclip;
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${dragActive 
            ? 'border-blue-500 bg-blue-50 scale-105' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          multiple
                          accept=".txt,.pdf,.docx,.csv"
          onChange={handleFileInput}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-full">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Documents
            </h3>
            <p className="text-gray-600 mb-4">
              Drop your files here or click to browse
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                <strong>✨ Enhanced Support:</strong> Now supporting PDF, Word (DOCX), and text files!
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Supported: {getSupportedFileTypes()} (max 50MB each)
            </p>
          </div>
          
          <button
            onClick={() => document.getElementById('file-input')?.click()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <File className="w-4 h-4" />
            Select Files
          </button>
        </div>
      </div>

      {/* Sample Documents */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 mb-3">Or try our sample documents:</p>
        <button
          onClick={handleLoadSamples}
          disabled={loadingSamples}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
        >
          <FileText className="w-4 h-4" />
          {loadingSamples ? 'Loading...' : 'Load Sample Documents'}
        </button>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-medium text-gray-900 mb-3">
            Selected Files ({selectedFiles.length})
          </h4>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => {
              const FileIcon = getFileIcon(file);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <FileIcon className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                      <p className="text-xs text-blue-600">
                        {getFileTypeInfo(file)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}