import { InferenceClient } from "@huggingface/inference";
import { UploadedFile, WorkflowStep, StepStatus } from "../types";

// Validate API Key
const apiKey = "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";

if (!apiKey) {
  throw new Error("VITE_HF_TOKEN is not defined in environment variables");
}

const client = new InferenceClient(apiKey);
const MODEL_NAME = "Qwen/Qwen3-32B:groq";

/**
 * Helper to prepare file content as text for the prompt.
 * Note: Hugging Face text models don't support multimodal input like images/PDFs
 * So we'll extract text content only
 */
const getFileContent = (files: UploadedFile[]): string => {
  let content = "";

  files.forEach(f => {
    if (!f.content) return;

    if (typeof f.content === 'string' && f.content.startsWith('data:')) {
      // For base64 data (PDF/Images), we can only note their presence
      // as the model doesn't support multimodal input
      const match = f.content.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mimeType = match[1];
        content += `\n[File Attachment: ${f.name} (${mimeType}) - Binary content not displayable]\n`;
      }
    } else {
      // Raw text content
      const contentStr = f.content as string;
      content += `\nFile: ${f.name}\nType: ${f.category}\nContent:\n${contentStr}\n---\n`;
    }
  });

  return content;
};

/**
 * Helper to extract thinking text from response
 */
const extractThinking = (text: string): { thinking: string; content: string } => {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim();
    const content = text.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    return { thinking, content };
  }
  return { thinking: '', content: text };
};

export const generateWorkflowPlan = async (files: UploadedFile[]): Promise<string[]> => {
  const fileContent = getFileContent(files);
  
  const prompt = `You are an intelligent data processing agent.
Analyze the uploaded files (code, documents, images, PDFs).
Create a logical, step-by-step workflow to process this data and SOLVE the user's implicit problem.

Guidelines:
1. Start with analysis or understanding steps.
2. The FINAL step MUST be a "Solution" step that aggregates everything (e.g., "Generate the complete fixed code", "Write the final comprehensive report", "Produce the final output").
3. Keep the plan between 3 to 6 steps.

Return ONLY a JSON array of strings, where each string is a clear, actionable step description.
Example: ["Analyze the code for bugs", "Plan the refactoring", "Generate the complete refactored python script"]

Files to process:
${fileContent}

Respond with ONLY the JSON array, no other text:`;

  try {
    const chatCompletion = await client.chatCompletion({
      model: MODEL_NAME,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ]
    });

    const response = chatCompletion.choices[0].message.content || "";
    
    // Extract JSON from response (in case model adds extra text)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in response:", response);
      return ["Failed to generate plan."];
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Hugging Face Plan Error:", error);
    throw error;
  }
};

export const executeWorkflowStep = async (
  step: WorkflowStep, 
  files: UploadedFile[], 
  previousSteps: WorkflowStep[] = [],
  onChunk?: (chunk: string) => void // Add callback for streaming
): Promise<{ result: string; thinking: string }> => {
  const fileContent = getFileContent(files);

  // Compile context from previous steps to give the agent "memory"
  const historyContext = previousSteps
    .filter(s => s.status === StepStatus.COMPLETED && s.result)
    .map(s => `PREVIOUS STEP: "${s.description}"\nRESULT: ${s.result}\n`)
    .join('\n---\n');

  const prompt = `You are an automated agent executing a workflow.

=== CONTEXT FROM PREVIOUS STEPS ===
${historyContext || "No previous steps executed yet."}
===================================

=== FILES ===
${fileContent}
=============

=== CURRENT TASK ===
Task: "${step.description}"

Perform this task strictly based on the provided files and the context above.

IMPORTANT OUTPUT INSTRUCTIONS:
- First, wrap your thinking process in <think></think> tags to show your reasoning.
- Then provide the actual output after the thinking tags.

- If the task is to WRITE CODE (e.g., fix a bug, generate a script, provide final solution):
  Provide the COMPLETE working code inside a standard markdown code block (e.g., \`\`\`python ... \`\`\`).
  Do not truncate the code. Do not use placeholders.
  If this is the final step, ensure the code is fully functional and solves the problem identified in previous steps.

- If the task is to WRITE A REPORT or DOCUMENT:
  Provide the COMPLETE text of the report/document.
  Use standard Markdown headers (#, ##) and formatting.
  The output should be ready to be saved as a document.

- If the task is analysis or summary:
  Provide a clear, concise result that can be used in the next steps.

Your response:`;

  try {
    let fullResponse = "";
    
    const stream = client.chatCompletionStream({
      model: MODEL_NAME,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      fullResponse += delta;
      
      // Send incremental updates to UI
      if (onChunk) {
        onChunk(delta);
      }
    }
    
    const { thinking, content } = extractThinking(fullResponse);
    
    return {
      result: content,
      thinking: thinking
    };
  } catch (error) {
    console.error("Hugging Face Execution Error:", error);
    return {
      result: "Error executing step: " + (error instanceof Error ? error.message : "Unknown error"),
      thinking: ""
    };
  }
};