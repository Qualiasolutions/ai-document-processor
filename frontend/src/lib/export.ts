import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { GeneratedForm } from '@/types';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { 
  PDF_STYLES, 
  DEFAULT_PDF_CONFIG, 
  PDFConfig,
  setTextColorFromHex,
  setDrawColorFromHex,
  setFillColorFromHex,
  getFieldIcon,
  formatDate,
  formatTimestamp,
  hexToRgb
} from './pdfStyles';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

// Helper function to add a professional header
function addPDFHeader(doc: jsPDF, title: string, config: PDFConfig = DEFAULT_PDF_CONFIG): number {
  const { colors, fonts, fontSize, layout, page } = PDF_STYLES;
  let yPosition = layout.margin.page;

  // Draw header background gradient
  setFillColorFromHex(doc, colors.primary);
  doc.rect(0, 0, page.width, page.headerHeight, 'F');
  
  // Add subtle pattern (lines)
  setDrawColorFromHex(doc, colors.primaryDark);
  doc.setLineWidth(0.1);
  for (let i = 0; i < page.headerHeight; i += 4) {
    doc.line(0, i, page.width, i);
  }

  // Company name/logo area
  doc.setFont(fonts.primary, 'bold');
  doc.setFontSize(fontSize.h2);
  doc.setTextColor(255, 255, 255);
  doc.text(config.companyName || 'AI Document Processor', layout.margin.page, yPosition + 8);
  
  // Tagline
  if (config.companyTagline) {
    doc.setFont(fonts.primary, 'normal');
    doc.setFontSize(fontSize.small);
    doc.text(config.companyTagline, layout.margin.page, yPosition + 15);
  }

  // Document title
  doc.setFont(fonts.primary, 'bold');
  doc.setFontSize(fontSize.h1);
  doc.text(title, layout.margin.page, yPosition + 28);

  return page.headerHeight + layout.margin.small;
}

// Helper function to add metadata section
function addMetadataSection(doc: jsPDF, form: GeneratedForm, yPosition: number): number {
  const { colors, fonts, fontSize, layout } = PDF_STYLES;
  
  // Metadata box
  setFillColorFromHex(doc, colors.background.highlight);
  setDrawColorFromHex(doc, colors.border.medium);
  doc.setLineWidth(0.5);
  doc.roundedRect(layout.margin.page, yPosition, PDF_STYLES.page.contentWidth, 35, 3, 3, 'FD');
  
  // Metadata content
  doc.setFont(fonts.primary, 'bold');
  doc.setFontSize(fontSize.small);
  setTextColorFromHex(doc, colors.text.primary);
  
  const metadata = [
    { label: 'Form Type:', value: form.template.name },
    { label: 'Generated:', value: formatTimestamp(new Date()) },
    { label: 'Total Fields:', value: `${Object.keys(form.data).length} fields` },
    { label: 'Form ID:', value: form.id.substring(0, 8).toUpperCase() }
  ];
  
  let xPos = layout.margin.page + layout.padding.small;
  let metaY = yPosition + 10;
  
  metadata.forEach((item, index) => {
    if (index % 2 === 0 && index > 0) {
      metaY += 12;
      xPos = layout.margin.page + layout.padding.small;
    }
    
    doc.setFont(fonts.primary, 'bold');
    doc.text(item.label, xPos, metaY);
    
    doc.setFont(fonts.primary, 'normal');
    setTextColorFromHex(doc, colors.text.secondary);
    doc.text(item.value, xPos + 30, metaY);
    
    xPos += 90;
  });
  
  return yPosition + 40;
}

// Helper function to add form data as a beautiful table
function addFormDataTable(doc: jsPDF, form: GeneratedForm, startY: number): number {
  const { colors, fonts, fontSize, table } = PDF_STYLES;
  
  // Prepare table data
  const tableData: any[][] = [];
  const validFields = form.template.fields.filter(field => form.data[field.name]);
  
  // Group fields by sections (customize based on form type)
  const sections: Record<string, typeof validFields> = {
    'Personal Information': [],
    'Contact Details': [],
    'Additional Information': []
  };
  
  // Categorize fields
  validFields.forEach(field => {
    const name = field.name.toLowerCase();
    const value = form.data[field.name];
    
    if (!value) return;
    
    if (name.includes('name') || name.includes('birth') || name.includes('gender') || name.includes('nationality')) {
      sections['Personal Information'].push(field);
    } else if (name.includes('email') || name.includes('phone') || name.includes('address')) {
      sections['Contact Details'].push(field);
    } else {
      sections['Additional Information'].push(field);
    }
  });
  
  // Build table data with sections
  Object.entries(sections).forEach(([sectionName, fields]) => {
    if (fields.length > 0) {
      // Add section header
      tableData.push([{
        content: sectionName,
        colSpan: 2,
        styles: {
          fillColor: hexToRgb(colors.accent),
          textColor: hexToRgb(colors.text.white),
          fontStyle: 'bold',
          fontSize: fontSize.normal
        }
      }]);
      
      // Add fields
      fields.forEach(field => {
        const value = form.data[field.name] || '';
        const icon = getFieldIcon(field.name, field.type);
        
        tableData.push([
          `${icon} ${field.label}`,
          value
        ]);
      });
    }
  });
  
  // Generate the table
  (doc as any).autoTable({
    startY: startY,
    head: [[
      { content: 'Field', styles: { fillColor: hexToRgb(colors.primary) } },
      { content: 'Value', styles: { fillColor: hexToRgb(colors.primary) } }
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      font: fonts.primary,
      fontSize: fontSize.normal,
      cellPadding: table.cellPadding,
      lineColor: hexToRgb(colors.border.light),
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: hexToRgb(colors.primary),
      textColor: hexToRgb(colors.text.white),
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: hexToRgb(colors.background.section)
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 'auto' }
    },
    margin: { left: PDF_STYLES.layout.margin.page, right: PDF_STYLES.layout.margin.page },
    didDrawPage: function(data: any) {
      // Add page footer on each page
      addPageFooter(doc, data.pageNumber, doc.getNumberOfPages());
    }
  });
  
  return (doc as any).lastAutoTable.finalY || startY;
}

// Helper function to add page footer
function addPageFooter(doc: jsPDF, currentPage: number, totalPages: number, config: PDFConfig = DEFAULT_PDF_CONFIG) {
  const { colors, fonts, fontSize, layout, page } = PDF_STYLES;
  const footerY = page.height - layout.margin.small - 5;
  
  // Footer line
  setDrawColorFromHex(doc, colors.border.light);
  doc.setLineWidth(0.5);
  doc.line(layout.margin.page, footerY - 5, page.width - layout.margin.page, footerY - 5);
  
  // Footer text
  doc.setFont(fonts.primary, 'italic');
  doc.setFontSize(fontSize.tiny);
  setTextColorFromHex(doc, colors.text.light);
  
  // Left side - company/generator info
  doc.text(config.footerText || 'Generated by AI Document Processor', layout.margin.page, footerY);
  
  // Center - timestamp
  const timestamp = formatTimestamp(new Date());
  const timestampWidth = doc.getTextWidth(timestamp);
  doc.text(timestamp, (page.width - timestampWidth) / 2, footerY);
  
  // Right side - page numbers
  const pageText = `Page ${currentPage} of ${totalPages}`;
  const pageTextWidth = doc.getTextWidth(pageText);
  doc.text(pageText, page.width - layout.margin.page - pageTextWidth, footerY);
}

// Helper function to add watermark
function addWatermark(doc: jsPDF, text: string, config: PDFConfig = DEFAULT_PDF_CONFIG) {
  const { page } = PDF_STYLES;
  
  // Save the current graphics state
  doc.saveGraphicsState();
  
  // Set watermark style
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(60);
  doc.setTextColor(230, 230, 230); // Light gray color for watermark
  
  // Calculate center position
  const textWidth = doc.getTextWidth(text);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Add watermark text diagonally across the page
  const x = pageWidth / 2;
  const y = pageHeight / 2;
  
  // Create a semi-transparent appearance by using light color
  // Note: jsPDF doesn't support opacity directly, so we use light colors
  doc.text(text, x, y, {
    align: 'center',
    angle: 45
  });
  
  // Restore graphics state
  doc.restoreGraphicsState();
}

export async function exportToPDF(form: GeneratedForm, config: PDFConfig = DEFAULT_PDF_CONFIG): Promise<void> {
  const doc = new jsPDF();
  
  // Add watermark if configured
  if (config.showWatermark && config.watermarkText) {
    addWatermark(doc, config.watermarkText, config);
  }
  
  // Add professional header
  let yPosition = addPDFHeader(doc, form.template.name, config);
  
  // Add spacing after header
  yPosition += PDF_STYLES.layout.spacing.section;
  
  // Add metadata section if configured
  if (config.includeMetadata) {
    yPosition = addMetadataSection(doc, form, yPosition);
    yPosition += PDF_STYLES.layout.spacing.section;
  }
  
  // Add form data as a beautiful table
  yPosition = addFormDataTable(doc, form, yPosition);
  
  // Add signature section if it's certain form types
  const needsSignature = ['employment_application', 'legal_document', 'financial_declaration'].includes(form.formType);
  if (needsSignature && yPosition < PDF_STYLES.page.maxY - 40) {
    yPosition += PDF_STYLES.layout.spacing.section;
    addSignatureSection(doc, yPosition);
  }
  
  // Add footer to first page if not already added by autoTable
  if (doc.getNumberOfPages() === 1) {
    addPageFooter(doc, 1, 1, config);
  }
  
  // Save the PDF
  const filename = `${form.template.name.replace(/\s+/g, '_')}_${formatDate(new Date()).replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

// Helper function to add signature section
function addSignatureSection(doc: jsPDF, yPosition: number) {
  const { colors, fonts, fontSize, layout } = PDF_STYLES;
  
  // Check if we need a new page
  if (yPosition > PDF_STYLES.page.maxY - 40) {
    doc.addPage();
    yPosition = layout.margin.page;
  }
  
  // Signature box
  setFillColorFromHex(doc, colors.background.white);
  setDrawColorFromHex(doc, colors.border.medium);
  doc.setLineWidth(0.5);
  doc.rect(layout.margin.page, yPosition, PDF_STYLES.page.contentWidth, 35, 'D');
  
  // Signature lines
  const signatureY = yPosition + 25;
  const halfWidth = PDF_STYLES.page.contentWidth / 2 - 10;
  
  // Applicant signature
  doc.setLineWidth(0.3);
  doc.line(layout.margin.page + 5, signatureY, layout.margin.page + halfWidth, signatureY);
  
  doc.setFont(fonts.primary, 'normal');
  doc.setFontSize(fontSize.small);
  setTextColorFromHex(doc, colors.text.secondary);
  doc.text('Applicant Signature', layout.margin.page + 5, signatureY + 5);
  doc.text(`Date: ${formatDate(new Date())}`, layout.margin.page + 5, signatureY + 10);
  
  // Authorized signature
  doc.line(layout.margin.page + halfWidth + 15, signatureY, layout.margin.page + PDF_STYLES.page.contentWidth - 5, signatureY);
  doc.text('Authorized Signature', layout.margin.page + halfWidth + 15, signatureY + 5);
  doc.text(`Date: _______________`, layout.margin.page + halfWidth + 15, signatureY + 10);
}

export async function exportToExcel(form: GeneratedForm): Promise<void> {
  // Create enhanced CSV content with better formatting
  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  
  // Add header
  csvContent += `"${form.template.name}"\n`;
  csvContent += `"Generated on: ${new Date().toLocaleDateString()}"\n\n`;
  
  // Add column headers
  csvContent += '"Field","Value"\n';
  
  // Add data
  form.template.fields.forEach(field => {
    const value = form.data[field.name] || '';
    // Escape quotes and handle newlines
    const escapedValue = value.replace(/"/g, '""').replace(/\n/g, ' ');
    csvContent += `"${field.label}","${escapedValue}"\n`;
  });
  
  // Add metadata
  csvContent += '\n"Metadata"\n';
  csvContent += `"Form Type","${form.template.name}"\n`;
  csvContent += `"Generated","${new Date().toISOString()}"\n`;
  csvContent += `"Total Fields","${Object.keys(form.data).length}"\n`;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${form.template.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportToWord(form: GeneratedForm): Promise<void> {
  // Create a professional Word document
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: form.template.name,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 400,
          },
        }),
        
        // Date
        new Paragraph({
          text: `Generated on: ${new Date().toLocaleDateString()}`,
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 600,
          },
          style: "subtitle",
        }),
        
        // Form content
        ...form.template.fields.flatMap(field => {
          const value = form.data[field.name];
          if (!value) return [];
          
          return [
            // Field label
            new Paragraph({
              children: [
                new TextRun({
                  text: field.label,
                  bold: true,
                  size: 24, // 12pt
                }),
              ],
              spacing: {
                before: 200,
                after: 100,
              },
            }),
            
            // Field value
            new Paragraph({
              text: value,
              spacing: {
                after: 300,
              },
              indent: {
                left: 720, // 0.5 inch
              },
            }),
          ];
        }),
        
        // Footer
        new Paragraph({
          children: [
            new TextRun({
              text: "Generated by AI Document Processor",
              italics: true,
              size: 20, // 10pt
              color: "999999",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            before: 800,
          },
          border: {
            top: {
              color: "CCCCCC",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        }),
      ],
    }],
  });
  
  // Generate and save the document
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${form.template.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`);
}