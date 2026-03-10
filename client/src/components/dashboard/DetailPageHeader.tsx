import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface DetailPageHeaderProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DetailPageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  badge,
  actions,
}: DetailPageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 min-w-0">
          <Link href={backHref}>
            <Button variant="outline" size="sm" className="w-fit">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {backLabel}
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-600 mt-0.5 text-sm sm:text-base">{subtitle}</p>
            )}
            {badge && <div className="mt-2 flex flex-wrap gap-2">{badge}</div>}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 items-center sm:flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
