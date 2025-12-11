import React, { useState, useEffect } from 'react';
import { UploadedFile, WorkflowStep, StepStatus, AgentState } from './types';
import FileUpload from './components/FileUpload';
import WorkflowList from './components/WorkflowList';
import { generateWorkflowPlan, executeWorkflowStep } from './services/geminiService';
import { Bot, Sparkles, StopCircle, RefreshCw, LayoutDashboard } from 'lucide-react';

export const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [agentState, setAgentState] = useState<AgentState>({
    isAnalyzing: false,
    isExecuting: false,
    currentStepId: null,
  });
  const [error, setError] = useState<string | null>(null);

  // Auto-executor: watches for steps that are pending and runs them sequentially
  useEffect(() => {
    if (!agentState.isExecuting) return;

    const executeNextStep = async () => {
      const nextStepIndex = workflowSteps.findIndex(s => s.status === StepStatus.PENDING);
      
      if (nextStepIndex === -1) {
        setAgentState(prev => ({ ...prev, isExecuting: false, currentStepId: null }));
        return;
      }

      const nextStep = workflowSteps[nextStepIndex];
      
      // Update status to PROCESSING
      setWorkflowSteps(prev => prev.map(s => 
        s.id === nextStep.id ? { ...s, status: StepStatus.PROCESSING } : s
      ));
      setAgentState(prev => ({ ...prev, currentStepId: nextStep.id }));

      try {
        // Execute the step via Gemini - now returns { result, thinking }
        const { result, thinking } = await executeWorkflowStep(nextStep, files, workflowSteps);
        
        // Update status to COMPLETED with result AND thinking
        setWorkflowSteps(prev => prev.map(s => 
          s.id === nextStep.id ? { 
            ...s, 
            status: StepStatus.COMPLETED, 
            result,
            thinking 
          } : s
        ));
      } catch (err) {
        console.error("Step execution failed:", err);
        setWorkflowSteps(prev => prev.map(s => 
          s.id === nextStep.id ? { 
            ...s, 
            status: StepStatus.FAILED, 
            result: "Failed to execute step." 
          } : s
        ));
        // Stop execution on failure
        setAgentState(prev => ({ ...prev, isExecuting: false }));
      }
    };

    executeNextStep();
  }, [workflowSteps, agentState.isExecuting, files]);

  const handleCreateWorkflow = async () => {
    if (files.length === 0) return;
    
    setAgentState(prev => ({ ...prev, isAnalyzing: true }));
    setError(null);
    setWorkflowSteps([]);

    try {
      const planStrings = await generateWorkflowPlan(files);
      
      const newSteps: WorkflowStep[] = planStrings.map(desc => ({
        id: Math.random().toString(36).substring(2, 9),
        description: desc,
        status: StepStatus.PENDING
      }));

      setWorkflowSteps(newSteps);
      // Automatically start executing
      setAgentState(prev => ({ ...prev, isAnalyzing: false, isExecuting: true }));

    } catch (err) {
      console.error(err);
      setError("Failed to generate a workflow. Please check your API key or try again.");
      setAgentState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const handleReset = () => {
    setFiles([]);
    setWorkflowSteps([]);
    setAgentState({ isAnalyzing: false, isExecuting: false, currentStepId: null });
    setError(null);
  };

  const completedSteps = workflowSteps.filter(step => step.status === StepStatus.COMPLETED).length;
  const totalSteps = workflowSteps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 flex flex-col">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Gemini Agent Workflow</h1>
                <p className="text-slate-400 text-sm">Automated Code & Document Analysis</p>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium"
            >
                <RefreshCw className="w-4 h-4" /> Reset
            </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Left Panel: Upload & Controls */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-blue-400" />
                Data Input
            </h2>
            
            <FileUpload 
                files={files} 
                setFiles={setFiles} 
                disabled={agentState.isAnalyzing || agentState.isExecuting} 
            />

            <div className="mt-6">
                <button
                    onClick={handleCreateWorkflow}
                    disabled={files.length === 0 || agentState.isAnalyzing || agentState.isExecuting}
                    className={`
                        w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all shadow-lg
                        ${files.length === 0 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                            : agentState.isAnalyzing || agentState.isExecuting
                                ? 'bg-blue-600/50 text-blue-100 cursor-wait'
                                : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/25'}
                    `}
                >
                    {agentState.isAnalyzing ? (
                        <>
                            <Sparkles className="w-5 h-5 animate-spin" />
                            Designing Workflow...
                        </>
                    ) : agentState.isExecuting ? (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Agent Working...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Generate & Run Workflow
                        </>
                    )}
                </button>

                {totalSteps > 0 && agentState.isExecuting && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1 text-sm text-slate-400">
                      <span>Progress</span>
                      <span>{completedSteps} / {totalSteps} steps completed</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                    {error}
                </div>
            )}
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-sm text-slate-400">
             <h3 className="text-slate-200 font-medium mb-2">How it works</h3>
             <ol className="list-decimal list-inside space-y-2">
                 <li>Upload code files (py, c, cpp) or docs.</li>
                 <li>The Agent reads the content.</li>
                 <li>Agent plans a custom workflow.</li>
                 <li>Agent executes steps one-by-one.</li>
             </ol>
          </div>
        </section>

        {/* Right Panel: Agent Workflow */}
        <section className="lg:col-span-8 h-[600px] lg:h-auto min-h-[500px] flex flex-col">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-full backdrop-blur-sm overflow-y-auto custom-scrollbar flex flex-col">
                <WorkflowList steps={workflowSteps} />
            </div>
        </section>

      </main>
    </div>
  );
};