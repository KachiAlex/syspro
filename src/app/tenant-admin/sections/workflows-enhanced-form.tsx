"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useFormValidation, commonValidationRules } from "@/hooks/use-form-validation";
import { 
  EnhancedForm, 
  EnhancedInput, 
  EnhancedSelect, 
  FormSubmitButton, 
  FormMessages,
  FormProgress 
} from "@/components/form/enhanced-form";
import { useToast } from "@/components/ui/toast";
import { InlineErrorBoundary } from "@/components/ui/error-boundary";
import { handleApiCall } from "@/lib/error-handling";
import { Workflow, WorkflowStep, ResourceId, TenantSlug } from "@/lib/tenant-admin/types";
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  FileText,
  Zap,
  GitBranch,
  Timer,
  Calendar,
  User,
  Building,
  Target,
  ArrowRight,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Download,
  Plus,
  X
} from "lucide-react";

type LocalWorkflowStep = {
  id: string;
  title: string;
  type: string;
  assignee?: string;
  daysAfter?: number;
  conditions?: any[];
};

type LocalWorkflow = {
  id: string;
  name: string;
  type: "onboarding" | "transfer" | "promotion" | "exit" | "approval" | "notification" | "automation";
  description?: string;
  steps: LocalWorkflowStep[];
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
  successRate?: number;
};

const WORKFLOW_TYPES = [
  { value: "onboarding", label: "Employee Onboarding", icon: Users, description: "New hire onboarding process" },
  { value: "transfer", label: "Department Transfer", icon: ArrowRight, description: "Employee transfer workflow" },
  { value: "promotion", label: "Promotion Process", icon: TrendingUp, description: "Employee promotion workflow" },
  { value: "exit", label: "Employee Exit", icon: Square, description: "Employee offboarding process" },
  { value: "approval", label: "Approval Chain", icon: CheckCircle, description: "Multi-level approval process" },
  { value: "notification", label: "Notification Flow", icon: AlertCircle, description: "Automated notifications" },
  { value: "automation", label: "Business Automation", icon: Zap, description: "Custom business process" }
] as const;

// Zod schema for workflow validation
const workflowSchema = z.object({
  name: z.string()
    .min(3, "Workflow name must be at least 3 characters")
    .max(100, "Workflow name must not exceed 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Workflow name can only contain letters, numbers, spaces, hyphens, and underscores"),
  type: z.enum(["onboarding", "transfer", "promotion", "exit", "approval", "notification", "automation"], {
    errorMap: () => ({ message: "Please select a valid workflow type" })
  }),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
});

type WorkflowFormData = z.infer<typeof workflowSchema>;

interface WorkflowStepForm {
  title: string;
  assignee: string;
  daysAfter: number;
}

interface EnhancedWorkflowFormProps {
  tenantSlug?: string | null;
  onSuccess?: (workflow: Workflow) => void;
  onCancel?: () => void;
  initialData?: Partial<WorkflowFormData>;
}

export default function EnhancedWorkflowForm({ 
  tenantSlug, 
  onSuccess, 
  onCancel,
  initialData 
}: EnhancedWorkflowFormProps) {
  const toast = useToast();
  const [steps, setSteps] = useState<WorkflowStepForm[]>([
    { title: "", assignee: "", daysAfter: 0 }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useFormValidation<WorkflowFormData>({
    initialValues: {
      name: initialData?.name || "",
      type: initialData?.type || "onboarding",
      description: initialData?.description || "",
    },
    validationSchema: workflowSchema,
    validationRules: {
      name: {
        ...commonValidationRules.required,
        minLength: 3,
        maxLength: 100,
        custom: (value) => {
          if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
            return "Workflow name can only contain letters, numbers, spaces, hyphens, and underscores";
          }
          return null;
        }
      },
      type: commonValidationRules.required,
    },
    onSubmit: async (values: WorkflowFormData) => {
      setIsSubmitting(true);
      
      try {
        // Validate steps
        const stepErrors = validateSteps();
        if (stepErrors.length > 0) {
          toast.error("Validation Error", "Please complete all required workflow steps");
          setCurrentStep(0);
          return;
        }

        const payload = {
          ...values,
          steps: steps.map((s, i) => ({ 
            step: i + 1, 
            title: s.title.trim(), 
            assignee: s.assignee.trim() || undefined, 
            daysAfter: s.daysAfter 
          })),
        };

        const response = await handleApiCall(() => 
          fetch(`/api/tenant/workflows?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
          {
            context: "Workflow Creation",
            showUserMessage: true,
          }
        );

        if (response.success && response.data) {
          toast.success("Success!", "Workflow created successfully");
          onSuccess?.(response.data as Workflow);
        }
      } catch (error) {
        console.error("Workflow creation error:", error);
        toast.error("Error", "Failed to create workflow. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {},
    onError: (errors) => {
      toast.error("Validation Error", "Please fix the errors and try again");
    },
  });

  const validateSteps = (): string[] => {
    const errors: string[] = [];
    
    steps.forEach((step, index) => {
      if (!step.title.trim()) {
        errors.push(`Step ${index + 1}: Title is required`);
      }
      if (step.daysAfter < 0) {
        errors.push(`Step ${index + 1}: Days after must be 0 or greater`);
      }
    });

    return errors;
  };

  const updateStep = (index: number, field: keyof WorkflowStepForm, value: string | number) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const addStep = () => {
    setSteps(prev => [...prev, { title: "", assignee: "", daysAfter: 0 }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(prev => prev.filter((_, i) => i !== index));
    }
  };

  const formSteps = [
    { label: "Basic Info", completed: currentStep > 0, current: currentStep === 0 },
    { label: "Workflow Steps", completed: currentStep > 1, current: currentStep === 1 },
    { label: "Review & Create", completed: false, current: currentStep === 2 },
  ];

  const nextStep = () => {
    if (currentStep < formSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <EnhancedInput
                label="Workflow Name"
                placeholder="e.g., New Hire Onboarding"
                required
                {...form.getFieldProps("name")}
              />
              
              <EnhancedSelect
                label="Workflow Type"
                required
                options={WORKFLOW_TYPES.map(type => ({
                  value: type.value,
                  label: type.label
                }))}
                {...form.getFieldProps("type")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                className="bg-white w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                rows={3}
                placeholder="Describe the purpose and scope of this workflow..."
                value={form.values.description || ""}
                onChange={(e) => form.setFieldValue("description", e.target.value)}
                onBlur={() => form.setFieldTouched("description")}
              />
              {form.errors.description && form.touched.description && (
                <p className="mt-1 text-xs text-red-600">{form.errors.description}</p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Workflow Type Information</h4>
              <div className="text-sm text-blue-800">
                {WORKFLOW_TYPES.find(type => type.value === form.values.type)?.description}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Workflow Steps</h3>
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Step
                </button>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <InlineErrorBoundary key={index}>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Step {index + 1}</h4>
                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Step Title *
                          </label>
                          <input
                            type="text"
                            value={step.title}
                            onChange={(e) => updateStep(index, "title", e.target.value)}
                            placeholder="e.g., Setup user account"
                            className="bg-white w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {!step.title.trim() && (
                            <p className="mt-1 text-xs text-red-600">Title is required</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Assignee
                          </label>
                          <input
                            type="text"
                            value={step.assignee}
                            onChange={(e) => updateStep(index, "assignee", e.target.value)}
                            placeholder="e.g., HR Manager"
                            className="bg-white w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Days After Start
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={step.daysAfter}
                            onChange={(e) => updateStep(index, "daysAfter", parseInt(e.target.value) || 0)}
                            className="bg-white w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </InlineErrorBoundary>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Workflow Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-700">Basic Information</h4>
                  <div className="mt-2 space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {form.values.name}</div>
                    <div><span className="font-medium">Type:</span> {WORKFLOW_TYPES.find(t => t.value === form.values.type)?.label}</div>
                    {form.values.description && (
                      <div><span className="font-medium">Description:</span> {form.values.description}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-slate-700">Workflow Steps ({steps.length})</h4>
                  <div className="mt-2 space-y-2">
                    {steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-4 text-sm bg-theme-muted p-2 rounded border">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{step.title || "Untitled Step"}</div>
                          {step.assignee && <div className="text-slate-500">Assignee: {step.assignee}</div>}
                        </div>
                        <div className="text-slate-500">Day {step.daysAfter}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Before You Create</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Review all workflow steps for accuracy</li>
                <li>• Ensure assignees have the necessary permissions</li>
                <li>• Test the workflow with a small group first</li>
                <li>• Document the workflow for team members</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <FormMessages
        error={form.globalError}
        success={form.globalSuccess}
        onClear={form.clearMessages}
      />

      <FormProgress steps={formSteps} className="mb-8" />

      <EnhancedForm
        initialValues={form.values}
        validationSchema={workflowSchema}
        onSubmit={async (values: WorkflowFormData) => {
          setIsSubmitting(true);
          
          try {
            // Validate steps
            const stepErrors = validateSteps();
            if (stepErrors.length > 0) {
              toast.error("Validation Error", "Please complete all required workflow steps");
              setCurrentStep(0);
              return;
            }

            const payload = {
              ...values,
              steps: steps.map((s, i) => ({ 
                step: i + 1, 
                title: s.title.trim(), 
                assignee: s.assignee.trim() || undefined, 
                daysAfter: s.daysAfter 
              })),
            };

            const response = await handleApiCall(() =>
              fetch(`/api/tenant/workflows?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }),
              {
                context: "Workflow Creation",
                showUserMessage: true,
              }
            );

            if (response.success && response.data) {
              toast.success("Workflow Created", "Workflow has been created successfully");
              onSuccess?.(response.data as Workflow);
            }
          } catch (error) {
            console.error("Workflow creation error:", error);
            toast.error("Creation Failed", "Failed to create workflow. Please try again.");
          } finally {
            setIsSubmitting(false);
          }
        }}
        className="space-y-6"
      >
        {(formProps) => (
          <>
            {renderStepContent()}

            <div className="flex justify-between pt-6 border-t border-slate-200">
              <div>
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Previous
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}

                {currentStep < formSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </button>
                ) : (
                  <FormSubmitButton
                    isSubmitting={isSubmitting}
                    submitText="Create Workflow"
                    loadingText="Creating..."
                    successText="Created!"
                    className="px-6"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </EnhancedForm>
    </div>
  );
}
