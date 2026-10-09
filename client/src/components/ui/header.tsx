import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function Header({ title, subtitle, breadcrumbs }: HeaderProps) {
  return (
    <div className="border-b border-border pb-4 mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
              {item.href ? (
                <Link href={item.href}>
                  <span className="hover:text-foreground cursor-pointer">
                    {item.label}
                  </span>
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}