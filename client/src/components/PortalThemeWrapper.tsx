import { ReactNode } from "react";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { CustomerPortalLayout } from "./CustomerPortalLayout";
import { ModernPortalLayout } from "./ModernPortalLayout";
import { Skeleton } from "@/components/ui/skeleton";

interface PortalThemeWrapperProps {
  children: ReactNode;
  modernChildren?: ReactNode;
}

export function PortalThemeWrapper({ children, modernChildren }: PortalThemeWrapperProps) {
  const { portalTheme, isLoading } = usePortalTheme();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <Skeleton className="h-4 w-32 mx-auto bg-slate-700" />
        </div>
      </div>
    );
  }

  if (portalTheme === "modern") {
    return (
      <ModernPortalLayout>
        {modernChildren || children}
      </ModernPortalLayout>
    );
  }

  // Default to classic theme
  return (
    <CustomerPortalLayout>
      {children}
    </CustomerPortalLayout>
  );
}
