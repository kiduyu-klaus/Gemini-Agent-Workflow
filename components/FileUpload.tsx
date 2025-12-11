import React, { useRef, useState } from 'react';
import { Upload, FileCode, FileText, FileImage, FileQuestion, X } from 'lucide-react';
import { UploadedFile } from '../types';
import { generateId, readFileContent, formatFileSize, getFileCategory } from '../utils/fileUtils';

interface FileUploadProps {
  files: UploadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ files, setFiles, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
    }
    // Reset input value so same file can be selected again if needed
    if (inputRef.current) inputRef.current.value = '';
  };

  const processFiles = async (fileList: File[]) => {
    const newFiles: UploadedFile[] = await Promise.all(
      fileList.map(async (file) => {
        const content = await readFileContent(file);
        return {
          id: generateId(),
          name: file.name,
          type: file.type,
          size: file.size,
          content: content,
          category: getFileCategory(file.name, file.type),
        };
      })
    );
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getIcon = (category: string) => {
    switch (category) {
      case 'code': return <FileCode className="w-5 h-5 text-blue-400" />;
      case 'document': return <FileText className="w-5 h-5 text-green-400" />;
      case 'image': return <FileImage className="w-5 h-5 text-purple-400" />;
      default: return <FileQuestion className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer
          flex flex-col items-center justify-center text-center
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          multiple
          onChange={handleFileInput}
          disabled={disabled}
        />
        <div className="bg-slate-800 p-3 rounded-full mb-3">
            <Upload className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-200 font-medium">Click to upload or drag and drop</p>
        <p className="text-slate-400 text-sm mt-1">DOCX, PDF, Python, C++, etc.</p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar">
          {files.map((file) => (
            <div 
                key={file.id} 
                className="flex items-center justify-between bg-slate-800/80 border border-slate-700 p-3 rounded-lg group hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {getIcon(file.category)}
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                }}
                disabled={disabled}
                className={`p-1 hover:bg-slate-700 rounded-full text-slate-500 hover:text-red-400 transition-colors ${disabled ? 'hidden' : ''}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
