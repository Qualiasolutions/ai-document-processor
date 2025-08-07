import { DocumentInfo } from '@/types';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Simple text file reading - RELIABLE AND WORKING
function readTextContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || content.trim().length === 0) {
        reject(new Error('File appears to be empty or contains no readable text'));
        return;
      }
      resolve(content);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

// Read PDF content using PDF.js
async function readPDFContent(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    if (!fullText.trim()) {
      throw new Error('PDF appears to be empty or contains no extractable text. It might be an image-based PDF.');
    }
    
    return fullText;
  } catch (error) {
    console.error('PDF reading error:', error);
    throw new Error(`Failed to read PDF: ${error.message}. The file might be corrupted or image-based.`);
  }
}

// Read DOCX content using Mammoth with enhanced error handling
async function readDOCXContent(file: File): Promise<string> {
  try {
    // Validate file size first (mammoth can struggle with very large files)
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    if (file.size > maxSize) {
      throw new Error(`DOCX file is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 50MB.`);
    }

    // Validate it's actually a DOCX file
    const fileName = file.name.toLowerCase();
    const expectedMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (!fileName.endsWith('.docx') && file.type !== expectedMimeType) {
      throw new Error('File does not appear to be a valid DOCX document. Please ensure it\'s a Microsoft Word (.docx) file.');
    }

    console.log(`Starting DOCX text extraction for: ${file.name} (${Math.round(file.size / 1024)}KB)`);
    
    const arrayBuffer = await file.arrayBuffer();
    
    // Validate the arrayBuffer
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('DOCX file appears to be empty or corrupted');
    }

    // Attempt to extract text with mammoth
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    // Log any warnings from mammoth
    if (result.messages.length > 0) {
      const warnings = result.messages.filter(m => m.type === 'warning');
      const errors = result.messages.filter(m => m.type === 'error');
      
      if (warnings.length > 0) {
        console.warn('DOCX extraction warnings:', warnings.map(w => w.message));
      }
      
      if (errors.length > 0) {
        console.error('DOCX extraction errors:', errors.map(e => e.message));
        throw new Error(`DOCX processing errors: ${errors.map(e => e.message).join(', ')}`);
      }
    }
    
    // Check if we got any text content
    if (!result.value || !result.value.trim()) {
      throw new Error('DOCX file appears to contain no readable text. The document may be empty, contain only images, or be corrupted.');
    }

    const extractedText = result.value.trim();
    console.log(`Successfully extracted ${extractedText.length} characters from DOCX file`);
    
    // Warn if text seems unusually short (might indicate extraction issues)
    if (extractedText.length < 10) {
      console.warn('DOCX text extraction resulted in very short content. Document may contain mostly images or formatting.');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('DOCX reading error:', error);
    
    // Provide more helpful error messages based on error type
    if (error.message.includes('not supported')) {
      throw new Error('This DOCX file format is not supported. Please try saving the document in a newer Word format.');
    } else if (error.message.includes('corrupted') || error.message.includes('invalid')) {
      throw new Error('DOCX file appears to be corrupted or invalid. Please try opening it in Microsoft Word and saving it again.');
    } else if (error.message.includes('too large')) {
      throw new Error(error.message); // Pass through size limit error as-is
    } else {
      throw new Error(`Failed to read DOCX file: ${error.message}. The file may be corrupted, password-protected, or in an unsupported format.`);
    }
  }
}

// Enhanced file reading with support for multiple formats
export async function readFileContent(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  
  // Validate file size (50MB limit)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 50MB.`);
  }

  // Validate file size minimum (empty files)
  if (file.size === 0) {
    throw new Error('File appears to be empty. Please select a file with content.');
  }
  
  try {
    console.log(`Processing file: ${file.name}, Type: ${file.type}, Size: ${Math.round(file.size / 1024)}KB`);
    
    // Text files
    if (fileName.endsWith('.txt') || 
        file.type === 'text/plain' || 
        file.type === 'text/csv' ||
        fileName.endsWith('.csv')) {
      console.log('Processing as text file');
      return await readTextContent(file);
    }
    
    // PDF files
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      console.log('Processing as PDF file');
      return await readPDFContent(file);
    }
    
    // DOCX files - enhanced detection
    if (fileName.endsWith('.docx') || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('Processing as DOCX file');
      return await readDOCXContent(file);
    }
    
    // DOC files (older Word format)
    if (fileName.endsWith('.doc') || file.type === 'application/msword') {
      throw new Error('Old Word DOC files are not supported. Please save your document as DOCX format in Microsoft Word.');
    }

    // Handle files with no mime type or generic mime type
    if (file.type === '' || file.type === 'application/octet-stream') {
      console.log('File has no mime type, attempting to determine format...');
      
      // Try to determine by extension
      if (fileName.endsWith('.docx')) {
        console.log('Extension suggests DOCX, attempting DOCX processing...');
        return await readDOCXContent(file);
      } else if (fileName.endsWith('.pdf')) {
        console.log('Extension suggests PDF, attempting PDF processing...');
        return await readPDFContent(file);
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
        console.log('Extension suggests text, attempting text processing...');
        return await readTextContent(file);
      } else {
        // Last resort - try as text
        console.log('Unknown extension, attempting text processing as fallback...');
        try {
          return await readTextContent(file);
        } catch {
          throw new Error(`Unable to determine file type. Supported formats: TXT, PDF, DOCX. Your file: ${fileName} (${file.type || 'unknown type'})`);
        }
      }
    }
    
    throw new Error(`Unsupported file type: "${file.type}" for file "${fileName}". Supported formats: TXT (.txt), PDF (.pdf), Word documents (.docx), CSV (.csv)`);
    
  } catch (error) {
    console.error(`Error reading file ${file.name}:`, error);
    
    // Re-throw with additional context for debugging
    if (error.message.includes('Failed to read')) {
      throw error; // Already has good error message
    } else {
      throw new Error(`Failed to process file "${file.name}": ${error.message}`);
    }
  }
}

export async function loadSampleDocuments(): Promise<File[]> {
  const sampleFiles = [
    { name: 'passport_sample.txt', path: '/sample-documents/passport_sample.txt' },
    { name: 'bank_statement.txt', path: '/sample-documents/bank_statement.txt' },
    { name: 'employment_contract.txt', path: '/sample-documents/employment_contract.txt' }
  ];
  
  const files = await Promise.all(
    sampleFiles.map(async (sample) => {
      try {
        const response = await fetch(sample.path);
        const content = await response.text();
        const blob = new Blob([content], { type: 'text/plain' });
        return new File([blob], sample.name, { type: 'text/plain' });
      } catch (error) {
        console.error(`Failed to load sample file ${sample.name}:`, error);
        // Return a placeholder file with demo content
        const demoContent = `Demo content for ${sample.name}`;
        const blob = new Blob([demoContent], { type: 'text/plain' });
        return new File([blob], sample.name, { type: 'text/plain' });
      }
    })
  );
  
  return files;
}

export function generateDocumentId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function validateFileType(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  // Support text, PDF, and DOCX files
  return fileName.endsWith('.txt') || 
         fileName.endsWith('.pdf') ||
         fileName.endsWith('.docx') ||
         fileName.endsWith('.csv') ||
         fileType === 'text/plain' || 
         fileType === 'text/csv' ||
         fileType === 'application/pdf' ||
         fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         fileType === '' ||
         fileType === 'application/octet-stream';
}

export function getSupportedFileTypes(): string {
  return 'Text files (.txt), PDF documents (.pdf), Word documents (.docx), CSV files (.csv)';
}

export function getFileTypeInfo(file: File): string {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.pdf')) {
    return 'PDF document - Text will be extracted and processed by AI';
  } else if (fileName.endsWith('.docx')) {
    return 'Word document - Text will be extracted and processed by AI';
  } else if (fileName.endsWith('.csv')) {
    return 'CSV file - Data will be extracted and processed by AI';
  } else {
    return 'Text file - Will be processed by AI to fill forms';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}