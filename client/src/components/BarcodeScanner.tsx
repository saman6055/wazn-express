import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CameraOff, SwitchCamera, Loader2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { soundManager } from "@/lib/soundManager";

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  isActive?: boolean;
}

export default function BarcodeScanner({ onScan, onError, isActive = true }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Get available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
          // Prefer back camera
          const backCameraIndex = devices.findIndex(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
          );
          if (backCameraIndex !== -1) {
            setCurrentCameraIndex(backCameraIndex);
          }
        }
      })
      .catch((err) => {
        console.error("Error getting cameras:", err);
        if (err.toString().includes("Permission")) {
          setPermissionDenied(true);
        }
      });
  }, []);

  // Start/stop scanner based on isActive prop
  useEffect(() => {
    if (!isActive && isScanning) {
      stopScanning();
    }
  }, [isActive]);

  const startScanning = async () => {
    if (!cameras.length) {
      onError?.(t("scan.noCameraFound"));
      return;
    }

    setIsLoading(true);
    try {
      const scanner = new Html5Qrcode("barcode-scanner-container");
      scannerRef.current = scanner;

      await scanner.start(
        cameras[currentCameraIndex].id,
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Debounce: prevent duplicate scans within 2 seconds
          const now = Date.now();
          if (decodedText === lastScannedRef.current && now - lastScanTimeRef.current < 2000) {
            return;
          }
          lastScannedRef.current = decodedText;
          lastScanTimeRef.current = now;

          // Vibrate on successful scan
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          // Play beep sound (shared manager respects sound toggle)
          soundManager.playBeep();

          onScan(decodedText);
        },
        () => {
          // Ignore scan errors (no barcode found)
        }
      );

      setIsScanning(true);
      setPermissionDenied(false);
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      if (err.toString().includes("Permission")) {
        setPermissionDenied(true);
        onError?.(t("scan.cameraPermissionDenied"));
      } else {
        onError?.(`${t("scan.scannerStartError")}: ${err.message || err}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;

    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);

    if (isScanning) {
      await stopScanning();
      // Small delay before restarting
      setTimeout(() => {
        startScanning();
      }, 300);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  if (permissionDenied) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <CameraOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            {t("scan.cameraPermissionMessage")}
          </p>
          <Button onClick={() => window.location.reload()}>
            {t("scan.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scanner viewport */}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden bg-black"
        style={{ minHeight: isScanning ? "300px" : "200px" }}
      >
        <div id="barcode-scanner-container" className="w-full h-full" />

        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50">
            <Camera className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm mb-4">
              {t("scan.clickToStartCamera")}
            </p>
            <Button
              onClick={startScanning}
              disabled={isLoading || cameras.length === 0}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t("scan.waiting")}
                </>
              ) : (
                <>
                  <Camera className="me-2 h-4 w-4" />
                  {t("scan.startCamera")}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Controls */}
      {isScanning && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={stopScanning}>
            <CameraOff className="me-2 h-4 w-4" />
            {t("scan.stop")}
          </Button>
          {cameras.length > 1 && (
            <Button variant="outline" onClick={switchCamera}>
              <SwitchCamera className="me-2 h-4 w-4" />
              {t("scan.switchCamera")}
            </Button>
          )}
        </div>
      )}

      {/* Camera info */}
      {cameras.length > 0 && isScanning && (
        <p className="text-xs text-center text-muted-foreground">
          {cameras[currentCameraIndex]?.label || t("scan.unknown")}
        </p>
      )}
    </div>
  );
}
