export interface UploadedFile {
  id: string;
  name: string;
  content: string | ArrayBuffer | null;
  category: 'code' | 'text' | 'image' | 'pdf' | 'document' | 'unknown';
  size: number;
}

export enum StepStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface WorkflowStep {
  id: string;
  description: string;
  status: StepStatus;
  result?: string;
  thinking?: string; // Add this new field
}

export interface AgentState {
  isAnalyzing: boolean;
  isExecuting: boolean;
  currentStepId: string | null;
}