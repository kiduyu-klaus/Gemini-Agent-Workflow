import { UploadedFile } from '../types';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
// Configure PDF.js worker - Use a specific known version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

export const getFileCategory = (filename: string, type: string): UploadedFile['category'] => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (['py', 'js', 'ts', 'tsx', 'c', 'cpp', 'h', 'java', 'go', 'rs', 'html', 'css', 'json', 'md'].includes(ext || '')) {
    return 'code';
  }
  if (type === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (type.startsWith('image/')) {
    return 'image';
  }
  if (['doc', 'docx', 'ppt', 'pptx', 'txt'].includes(ext || '') || type.includes('text') || type.includes('document')) {
    return 'document';
  }
  return 'unknown';
};

/**
 * Extract text from PDF using PDF.js
 */
const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
    }
    
    return fullText.trim();
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
};

export const readFileContent = (file: File): Promise<string | ArrayBuffer | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Handle DOCX specifically to extract text
      if (file.name.toLowerCase().endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const arrayBuffer = reader.result as ArrayBuffer;
            // Extract raw text from the DOCX file
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value); // The raw text string
          } catch (error) {
            console.error("Error parsing DOCX:", error);
            reject(error);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
        return;
      }

      // 2. Handle PDF - Extract text content
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const extractedText = await extractTextFromPDF(file);
          resolve(extractedText);
        } catch (error) {
          reject(error);
        }
        return;
      }

      // 3. Handle Images - Read as Data URL (Base64)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
        return;
      }

      // 4. Handle Code/Text - Read as Text
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    } catch (error) {
      reject(error);
    }
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Downloads a string content as a file with the given filename and mimetype.
 */
export const downloadFile = (filename: string, content: string | Blob, mimeType: string) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Converts Markdown-like text to a simple DOCX Blob.
 */
export const createDocxBlob = async (text: string): Promise<Blob> => {
  const lines = text.split('\n');
  const children = lines.map(line => {
    // Basic Markdown Header parsing
    if (line.startsWith('# ')) {
        return new Paragraph({
            text: line.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
        });
    }
    if (line.startsWith('## ')) {
        return new Paragraph({
            text: line.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 150, after: 100 },
        });
    }
    if (line.startsWith('### ')) {
        return new Paragraph({
            text: line.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 100, after: 50 },
        });
    }
    
    // Regular paragraph
    return new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 100 },
    });
  });

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBlob(doc);
};