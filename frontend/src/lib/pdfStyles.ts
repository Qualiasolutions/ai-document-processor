// PDF Styling Constants and Configuration
export const PDF_STYLES = {
  // Color Palette
  colors: {
    primary: '#2563eb',      // Blue 600
    primaryDark: '#1e40af',  // Blue 700
    secondary: '#64748b',    // Slate 500
    accent: '#06b6d4',       // Cyan 500
    text: {
      primary: '#1e293b',    // Slate 800
      secondary: '#475569',  // Slate 600
      light: '#94a3b8',      // Slate 400
      white: '#ffffff'
    },
    background: {
      white: '#ffffff',
      light: '#f8fafc',      // Slate 50
      section: '#f1f5f9',    // Slate 100
      highlight: '#e0f2fe',  // Blue 100
      accent: '#ecfeff'      // Cyan 50
    },
    border: {
      light: '#e2e8f0',      // Slate 200
      medium: '#cbd5e1',     // Slate 300
      dark: '#94a3b8'        // Slate 400
    },
    success: '#10b981',      // Emerald 500
    warning: '#f59e0b',      // Amber 500
    error: '#ef4444'         // Red 500
  },

  // Typography
  fonts: {
    primary: 'helvetica',
    secondary: 'times',
    mono: 'courier'
  },

  fontSize: {
    // Headers
    h1: 24,
    h2: 20,
    h3: 16,
    h4: 14,
    // Body
    large: 12,
    normal: 11,
    small: 10,
    tiny: 9,
    // Special
    title: 28,
    subtitle: 14
  },

  // Layout
  layout: {
    margin: {
      page: 20,
      section: 15,
      item: 8,
      small: 5
    },
    padding: {
      section: 10,
      cell: 8,
      small: 5
    },
    spacing: {
      section: 20,
      paragraph: 10,
      line: 6,
      small: 4
    }
  },

  // Page dimensions
  page: {
    width: 210,          // A4 width in mm
    height: 297,         // A4 height in mm
    contentWidth: 170,   // Width minus margins
    maxY: 270,          // Max Y position before new page
    headerHeight: 45,
    footerHeight: 20
  },

  // Table styles
  table: {
    headerBg: '#2563eb',
    headerText: '#ffffff',
    alternateRowBg: '#f8fafc',
    borderColor: '#e2e8f0',
    cellPadding: 8,
    fontSize: 10
  },

  // Section styles
  section: {
    borderRadius: 4,
    shadowOffset: 1,
    shadowBlur: 2
  }
};

// PDF Configuration Options
export interface PDFConfig {
  showLogo?: boolean;
  showWatermark?: boolean;
  includeMetadata?: boolean;
  includePageNumbers?: boolean;
  includeTimestamp?: boolean;
  companyName?: string;
  companyTagline?: string;
  footerText?: string;
  watermarkText?: string;
  accentColor?: string;
}

export const DEFAULT_PDF_CONFIG: PDFConfig = {
  showLogo: true,
  showWatermark: false,
  includeMetadata: true,
  includePageNumbers: true,
  includeTimestamp: true,
  companyName: 'AI Document Processor',
  companyTagline: 'Intelligent Form Generation',
  footerText: 'This document was generated automatically',
  watermarkText: 'DRAFT',
  accentColor: PDF_STYLES.colors.primary
};

// Helper function to convert hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Helper function to set text color from hex
export function setTextColorFromHex(doc: any, hex: string) {
  const rgb = hexToRgb(hex);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
}

// Helper function to set draw color from hex
export function setDrawColorFromHex(doc: any, hex: string) {
  const rgb = hexToRgb(hex);
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
}

// Helper function to set fill color from hex
export function setFillColorFromHex(doc: any, hex: string) {
  const rgb = hexToRgb(hex);
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
}

// Form field type icons (using Unicode symbols)
export const FIELD_ICONS: Record<string, string> = {
  text: '📝',
  email: '✉️',
  date: '📅',
  number: '🔢',
  textarea: '📄',
  phone: '📞',
  address: '📍',
  name: '👤',
  money: '💰',
  file: '📎'
};

// Get icon for field based on name or type
export function getFieldIcon(fieldName: string, fieldType: string): string {
  const name = fieldName.toLowerCase();
  
  if (name.includes('email')) return FIELD_ICONS.email;
  if (name.includes('date') || name.includes('birth')) return FIELD_ICONS.date;
  if (name.includes('phone') || name.includes('mobile')) return FIELD_ICONS.phone;
  if (name.includes('address') || name.includes('location')) return FIELD_ICONS.address;
  if (name.includes('name')) return FIELD_ICONS.name;
  if (name.includes('amount') || name.includes('salary') || name.includes('price')) return FIELD_ICONS.money;
  if (name.includes('file') || name.includes('document')) return FIELD_ICONS.file;
  
  return FIELD_ICONS[fieldType] || FIELD_ICONS.text;
}

// Format date for display
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Format timestamp
export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}