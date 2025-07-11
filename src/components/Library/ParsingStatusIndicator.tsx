"use client";

import {
  Clock,
  Download,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileText,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ParsingStatus =
  | 'IDLE'
  | 'PENDING_PDF_FETCH'
  | 'PENDING_PARSE'
  | 'AWAITING_MANUAL_UPLOAD'
  | 'PENDING_MINERU_SUBMISSION'
  | 'PARSING_IN_MINERU'
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'PARSING_FAILED';

interface ParsingStatusIndicatorProps {
  status: ParsingStatus;
  onUploadPdf?: () => void;
  showUploadButton?: boolean;
  className?: string;
  parsingProgress?: {
    extractedPages?: number;
    totalPages?: number;
    startTime?: string;
  };
}

interface StatusConfig {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  showUpload: boolean;
  animated?: boolean;
}

const statusConfigs: Record<ParsingStatus, StatusConfig> = {
  'IDLE': {
    icon: <Clock className="h-3 w-3" />,
    label: 'Idle',
    description: 'No processing has started yet',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    variant: 'outline',
    showUpload: false
  },
  'PENDING_PDF_FETCH': {
    icon: <Download className="h-3 w-3 animate-pulse" />,
    label: 'Fetching PDF',
    description: 'Attempting to download PDF from DOI or URL',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    variant: 'outline',
    showUpload: false,
    animated: true
  },
  'PENDING_PARSE': {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: 'Preparing',
    description: 'Preparing for parsing',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    variant: 'outline',
    showUpload: false,
    animated: true
  },
  'AWAITING_MANUAL_UPLOAD': {
    icon: <Upload className="h-3 w-3" />,
    label: 'Upload Required',
    description: 'PDF could not be found automatically. Manual upload required.',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    variant: 'outline',
    showUpload: true
  },
  'PENDING_MINERU_SUBMISSION': {
    icon: <FileText className="h-3 w-3 animate-pulse" />,
    label: 'Submitting',
    description: 'Submitting PDF to Mineru for processing',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    variant: 'outline',
    showUpload: false,
    animated: true
  },
  'PARSING_IN_MINERU': {
    icon: <Zap className="h-3 w-3 animate-pulse" />,
    label: 'Parsing',
    description: 'PDF is being processed by Mineru',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    variant: 'outline',
    showUpload: false,
    animated: true
  },
  'SUCCESS': {
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Complete',
    description: 'PDF has been successfully processed',
    color: 'bg-green-100 text-green-800 border-green-300',
    variant: 'outline',
    showUpload: false
  },
  'PARTIAL_SUCCESS': {
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'Partial',
    description: 'PDF was processed but some data may be incomplete',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    variant: 'outline',
    showUpload: false
  },
  'FAILED': {
    icon: <XCircle className="h-3 w-3" />,
    label: 'Failed',
    description: 'Processing failed due to an error. Document is saved, you can retry or manage manually.',
    color: 'bg-red-100 text-red-800 border-red-300',
    variant: 'destructive',
    showUpload: false
  },
  'PARSING_FAILED': {
    icon: <XCircle className="h-3 w-3" />,
    label: 'Parse Failed',
    description: 'PDF parsing failed in Mineru. Document is saved, you can retry or manage manually.',
    color: 'bg-red-100 text-red-800 border-red-300',
    variant: 'destructive',
    showUpload: false
  }
};

export function ParsingStatusIndicator({
  status,
  onUploadPdf,
  showUploadButton = true,
  className,
  parsingProgress
}: ParsingStatusIndicatorProps) {
  const config = statusConfigs[status];

  if (!config) {
    console.warn(`Unknown parsing status: ${status}`);
    return null;
  }

  const shouldShowUpload = config.showUpload && showUploadButton && onUploadPdf;
  const shouldShowProgress = status === 'PARSING_IN_MINERU' && parsingProgress && parsingProgress.totalPages && parsingProgress.totalPages > 0;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={config.variant}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs font-medium",
                config.color
              )}
            >
              {config.icon}
              <span>{config.label}</span>
              {shouldShowProgress && (
                <span className="ml-1 text-xs opacity-80">
                  {parsingProgress?.extractedPages || 0}/{parsingProgress?.totalPages || 0}
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{config.description}</p>
            {shouldShowProgress && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Progress:</span>
                  <span>{parsingProgress?.extractedPages || 0}/{parsingProgress?.totalPages || 0} pages</span>
                </div>
                <Progress
                  value={((parsingProgress?.extractedPages || 0) / (parsingProgress?.totalPages || 1)) * 100}
                  className="h-2 w-32"
                />
              </div>
            )}
          </TooltipContent>
        </Tooltip>

        {shouldShowProgress && (
          <div className="flex items-center gap-2">
            <Progress
              value={((parsingProgress?.extractedPages || 0) / (parsingProgress?.totalPages || 1)) * 100}
              className="h-2 w-16"
            />
            <span className="text-xs text-muted-foreground">
              {Math.round(((parsingProgress?.extractedPages || 0) / (parsingProgress?.totalPages || 1)) * 100)}%
            </span>
          </div>
        )}

        {shouldShowUpload && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUploadPdf}
            className="h-7 px-2 text-xs"
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload PDF
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

// Export the status type for use in other components
export type { ParsingStatus };