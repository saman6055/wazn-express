import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Keyboard,
  Camera,
  Search,
  Loader2,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { soundManager } from "@/lib/soundManager";
import { cn } from "@/lib/utils";

interface ScanInputProps {
  /** Called when a tracking number is submitted (Enter key or camera scan) */
  onScan: (trackingNumber: string) => void;
  /** Whether a scan is currently being processed */
  isProcessing?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether to auto-clear after scan */
  autoClear?: boolean;
  /** Whether continuous mode is enabled (auto-submit on camera scan) */
  continuousMode?: boolean;
  onContinuousModeChange?: (enabled: boolean) => void;
  /** Sound enabled toggle */
  soundEnabled?: boolean;
  onSoundEnabledChange?: (enabled: boolean) => void;
  /** Auto-focus the input on mount and after each scan */
  autoFocus?: boolean;
  /** Additional class for the container */
  className?: string;
  /** Whether to show the camera scanner option */
  showCameraOption?: boolean;
  /** Disable input (e.g. when batch not selected) */
  disabled?: boolean;
  /** Label text (translated) */
  labels?: {
    inputPlaceholder?: string;
    manualMode?: string;
    cameraMode?: string;
    continuousMode?: string;
    soundOn?: string;
    soundOff?: string;
    searching?: string;
  };
}

export function ScanInput({
  onScan,
  isProcessing = false,
  placeholder,
  autoClear = true,
  continuousMode = true,
  onContinuousModeChange,
  soundEnabled = true,
  onSoundEnabledChange,
  autoFocus = true,
  className,
  showCameraOption = true,
  disabled = false,
  labels = {},
}: ScanInputProps) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanTime = useRef<number>(0);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && scanMode === "manual") {
      inputRef.current?.focus();
    }
  }, [autoFocus, scanMode]);

  // Sync sound manager
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Handle manual submit
  const handleSubmit = useCallback(() => {
    const value = trackingNumber.trim();
    if (!value || isProcessing) return;

    // Debounce rapid scans (500ms)
    const now = Date.now();
    if (now - lastScanTime.current < 500) return;
    lastScanTime.current = now;

    onScan(value);

    if (autoClear) {
      setTrackingNumber("");
    }

    // Re-focus input
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [trackingNumber, isProcessing, onScan, autoClear]);

  // Handle camera scan result
  const handleCameraScan = useCallback(
    (result: string) => {
      soundManager.playBeep();
      soundManager.vibrate();

      if (continuousMode) {
        onScan(result.trim());
      } else {
        setTrackingNumber(result.trim());
        setScanMode("manual");
        inputRef.current?.focus();
      }
    },
    [continuousMode, onScan]
  );

  // Keyboard shortcut: Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setTrackingNumber("");
      inputRef.current?.focus();
    }
  };

  // Global keyboard shortcuts (Escape, Ctrl+M, Ctrl+S)
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTrackingNumber("");
        inputRef.current?.focus();
      }
      if (e.ctrlKey && e.key === "m") {
        e.preventDefault();
        setScanMode((prev) => (prev === "manual" ? "camera" : "manual"));
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        onSoundEnabledChange?.(!soundEnabled);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [soundEnabled, onSoundEnabledChange]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mode Toggle + Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Manual / Camera toggle */}
        {showCameraOption && (
          <div className="flex bg-gray-100 rounded-lg p-1 dark:bg-gray-800">
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                scanMode === "manual"
                  ? "bg-white shadow text-foreground dark:bg-gray-700"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setScanMode("manual")}
            >
              <Keyboard className="h-4 w-4" />
              {labels.manualMode || "Manual"}
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                scanMode === "camera"
                  ? "bg-white shadow text-foreground dark:bg-gray-700"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setScanMode("camera")}
            >
              <Camera className="h-4 w-4" />
              {labels.cameraMode || "Camera"}
            </button>
          </div>
        )}

        {/* Settings toggles */}
        <div className="flex items-center gap-4">
          {onContinuousModeChange && (
            <div className="flex items-center gap-2">
              <Switch
                checked={continuousMode}
                onCheckedChange={onContinuousModeChange}
              />
              <Label className="text-sm flex items-center gap-1 cursor-pointer">
                <Zap className="h-3.5 w-3.5" />
                {labels.continuousMode || "Continuous"}
              </Label>
            </div>
          )}
          {onSoundEnabledChange && (
            <button
              type="button"
              onClick={() => onSoundEnabledChange(!soundEnabled)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5 text-green-600" />
              ) : (
                <VolumeX className="h-5 w-5 text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Input or Camera */}
      {scanMode === "manual" ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              placeholder ||
              labels.inputPlaceholder ||
              "Tracking number..."
            }
            className="pl-10 pr-20 h-14 text-lg font-mono"
            disabled={isProcessing || disabled}
            autoFocus={autoFocus}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!trackingNumber.trim() || isProcessing || disabled}
            className="absolute right-1.5 top-1.5 h-11"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </Button>
        </div>
      ) : (
        <BarcodeScanner
          onScan={handleCameraScan}
          isActive={scanMode === "camera"}
        />
      )}
    </div>
  );
}
