import React, { useEffect, useRef, useState } from 'react';
import { WorkflowStep, StepStatus } from '../types';
import { Loader2, PlayCircle, Download, FileText, FileCode, ChevronDown, ChevronRight, Brain, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { downloadFile, createDocxBlob } from '../utils/fileUtils';

interface WorkflowListProps {
  steps: WorkflowStep[];
}

const WorkflowList: React.FC<WorkflowListProps> = ({ steps }) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState<{[key: string]: boolean}>({});
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(true);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  const toggleThinking = (stepId: string) => {
    setExpandedThinking(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const toggleWorkflow = () => {
    setIsWorkflowExpanded(prev => !prev);
  };

  // Helper to extract code block
  const extractCode = (markdown: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/;
    const match = markdown.match(codeBlockRegex);
    if (match) {
      return { language: match[1] || 'txt', code: match[2] };
    }
    return null;
  };

  const handleDownloadCode = (content: string, language: string) => {
    const extensions: {[key: string]: string} = {
      python: 'py', py: 'py',
      javascript: 'js', js: 'js',
      typescript: 'ts', ts: 'ts',
      cpp: 'cpp', c: 'c',
      java: 'java',
      html: 'html', css: 'css',
      json: 'json',
      markdown: 'md'
    };
    const ext = extensions[language.toLowerCase()] || 'txt';
    downloadFile(`agent_code_${Date.now()}.${ext}`, content, 'text/plain');
  };

  const handleDownloadDocx = async (content: string) => {
    try {
      const blob = await createDocxBlob(content);
      downloadFile(`agent_report_${Date.now()}.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } catch (e) {
      console.error("Failed to generate DOCX", e);
      alert("Failed to generate DOCX. Check console.");
    }
  };

  // Helper to get preview of thinking (first 3 lines)
  const getThinkingPreview = (thinking: string): string => {
    const lines = thinking.split('\n').filter(line => line.trim());
    return lines.slice(0, 3).join('\n');
  };

  // Get first 3 steps for preview
  const getStepsPreview = () => {
    return steps.slice(0, 3);
  };

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
            <PlayCircle className="w-8 h-8 opacity-50" />
        </div>
        <p>No workflow generated yet.</p>
        <p className="text-sm">Upload files and start the agent to see the magic.</p>
      </div>
    );
  }

  const stepsToShow = isWorkflowExpanded ? steps : getStepsPreview();

  return (
    <div className="space-y-6">
      {/* Collapsible Header */}
      <button
        onClick={toggleWorkflow}
        className="w-full flex items-center justify-between gap-2 text-lg font-semibold text-slate-100 hover:text-slate-50 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
          Agent Plan & Execution
          <span className="text-xs font-normal text-slate-400 ml-2">
            ({steps.length} step{steps.length !== 1 ? 's' : ''})
          </span>
        </div>
        {isWorkflowExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-300 transition-colors" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-300 transition-colors" />
        )}
      </button>

      {/* Workflow Steps */}
      <div className="space-y-4">
        {stepsToShow.map((step, index) => {
          const codeData = step.result ? extractCode(step.result) : null;
          const isPotentialReport = !codeData && step.status === StepStatus.COMPLETED && 
            (step.description.toLowerCase().includes('report') || 
             step.description.toLowerCase().includes('document') ||
             step.description.toLowerCase().includes('write') ||
             step.description.toLowerCase().includes('summar') ||
             (step.result && step.result.length > 500));

          const hasThinking = step.thinking && step.thinking.trim().length > 0;
          const isThinkingExpanded = expandedThinking[step.id];

          return (
            <div
              key={step.id}
              className={`
                relative pl-8 pb-2 border-l-2 last:border-l-0 transition-all duration-500
                ${step.status === StepStatus.COMPLETED ? 'border-blue-500/50' : 'border-slate-700'}
              `}
            >
              {/* Status Icon */}
              <div className={`
                absolute -left-[9px] top-0 w-4 h-4 rounded-full flex items-center justify-center bg-slate-900 border-2
                ${step.status === StepStatus.COMPLETED ? 'border-blue-500 text-blue-500' : ''}
                ${step.status === StepStatus.PROCESSING ? 'border-amber-500 text-amber-500' : ''}
                ${step.status === StepStatus.PENDING ? 'border-slate-600 text-slate-600' : ''}
                ${step.status === StepStatus.FAILED ? 'border-red-500 text-red-500' : ''}
              `}>
                  {step.status === StepStatus.COMPLETED && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                  {step.status === StepStatus.PROCESSING && <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
                  {step.status === StepStatus.PENDING && <div className="w-2 h-2 bg-slate-600 rounded-full" />}
                  {step.status === StepStatus.FAILED && <div className="w-2 h-2 bg-red-500 rounded-full" />}
              </div>

              {/* Content Card */}
              <div className={`
                  rounded-lg border p-4 transition-all duration-300
                  ${step.status === StepStatus.PROCESSING ? 'bg-slate-800/80 border-amber-500/30 ring-1 ring-amber-500/20' : ''}
                  ${step.status === StepStatus.COMPLETED ? 'bg-slate-800/40 border-slate-700' : ''}
                  ${step.status === StepStatus.PENDING ? 'bg-slate-900 border-slate-800 opacity-60' : ''}
                  ${step.status === StepStatus.FAILED ? 'bg-red-900/10 border-red-500/30' : ''}
              `}>
                  <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-slate-200">
                          Step {index + 1}: {step.description}
                      </h4>
                      <span className="text-xs font-mono uppercase tracking-wider opacity-70">
                          {step.status === StepStatus.PROCESSING && <span className="flex items-center gap-1 text-amber-400"><Loader2 className="w-3 h-3 animate-spin"/> Running</span>}
                          {step.status === StepStatus.COMPLETED && <span className="text-blue-400">Done</span>}
                          {step.status === StepStatus.FAILED && <span className="text-red-400">Failed</span>}
                      </span>
                  </div>

                  {/* Model Thinking Section */}
                  {hasThinking && (
                    <div className="mb-3">
                      <button
                        onClick={() => toggleThinking(step.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-500/30 rounded-md transition-colors text-left group"
                      >
                        <Brain className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-purple-300 flex-1">Model Thinking</span>
                        {isThinkingExpanded ? (
                          <ChevronDown className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
                        )}
                      </button>
                      
                      <div className={`mt-2 bg-purple-950/30 rounded border border-purple-500/20 overflow-hidden transition-all duration-300 ${isThinkingExpanded ? 'max-h-[1000px]' : 'max-h-[80px]'}`}>
                        <div className="p-3 text-xs text-purple-200/80 font-mono whitespace-pre-wrap">
                          {isThinkingExpanded ? step.thinking : getThinkingPreview(step.thinking)}
                          {!isThinkingExpanded && step.thinking.split('\n').filter(l => l.trim()).length > 3 && (
                            <span className="text-purple-400/60">...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Result Output */}
                  {(step.result || step.status === StepStatus.PROCESSING) && (
                      <div className="mt-3 bg-slate-950/50 rounded p-3 text-sm text-slate-300 border border-slate-800/50">
                          {step.status === StepStatus.PROCESSING && !step.result && (
                              <div className="flex items-center gap-2 text-slate-500">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Agent is analyzing files...</span>
                              </div>
                          )}
                          {step.result && (
                              <div className="space-y-4">
                                  <div className="prose prose-invert prose-sm max-w-none">
                                      <ReactMarkdown>{step.result}</ReactMarkdown>
                                  </div>

                                  {/* Download Buttons Section */}
                                  <div className="flex flex-wrap gap-2 mt-4 pt-2 border-t border-slate-800">
                                      {codeData && (
                                          <button
                                              onClick={() => handleDownloadCode(codeData.code, codeData.language)}
                                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-md transition-colors border border-blue-500/30"
                                          >
                                              <FileCode className="w-3.5 h-3.5" />
                                              Download Code (.{(codeData.language === 'python' ? 'py' : codeData.language) || 'txt'})
                                          </button>
                                      )}
                                      
                                      {isPotentialReport && (
                                          <button
                                              onClick={() => step.result && handleDownloadDocx(step.result)}
                                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-md transition-colors border border-emerald-500/30"
                                          >
                                              <FileText className="w-3.5 h-3.5" />
                                              Download Report (.docx)
                                          </button>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
              </div>
            </div>
          );
        })}

        {/* Show More Indicator */}
        {!isWorkflowExpanded && steps.length > 3 && (
          <div className="pl-8 text-sm text-slate-500 italic">
            ... and {steps.length - 3} more step{steps.length - 3 !== 1 ? 's' : ''}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
};

export default WorkflowList;