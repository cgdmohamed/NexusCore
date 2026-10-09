import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/lib/config";
import { userAvatarSrc } from "@/lib/user-avatar";
import { useQuery } from "@tanstack/react-query";
import { NotificationDropdown } from "../notifications/NotificationDropdown";
import { 
  Search, 
  Languages, 
  LogOut, 
  User,
  Building2,
  Check,
  Receipt,
  Users,
  CheckSquare,
  FileText,
  CreditCard,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User as UserType } from "@shared/schema";

interface SearchResult {
  id: string;
  title: string;
  type: 'client' | 'invoice' | 'task' | 'quotation' | 'expense';
  subtitle?: string;
  href: string;
}

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { t, language, changeLanguage } = useTranslation();
  const { user, logoutMutation } = useAuth();
  const { companyName } = useConfig();
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const currentUser = user as UserType | undefined;

  const getUserDisplayName = () => {
    if (currentUser && 'employee' in currentUser && currentUser.employee) {
      const employee = currentUser.employee as any;
      if (employee.firstName && employee.lastName) {
        return `${employee.firstName} ${employee.lastName}`;
      }
    }
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName} ${currentUser.lastName}`;
    }
    return currentUser?.email?.split('@')[0] || 'User';
  };

  const getUserInitials = () => {
    if (currentUser && 'employee' in currentUser && currentUser.employee) {
      const employee = currentUser.employee as any;
      if (employee.firstName && employee.lastName) {
        return `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
      }
    }
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    }
    const email = currentUser?.email || 'User';
    return email[0].toUpperCase() + (email[1] || '').toUpperCase();
  };

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: searchQuery.length >= 2,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
    enabled: searchQuery.length >= 2,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["/api/tasks"],
    enabled: searchQuery.length >= 2,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["/api/quotations"],
    enabled: searchQuery.length >= 2,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["/api/expenses"],
    enabled: searchQuery.length >= 2,
  });

  const getSearchResults = (): SearchResult[] => {
    if (!searchQuery || searchQuery.length < 2) return [];

    const results: SearchResult[] = [];
    const query = searchQuery.toLowerCase();

    (clients as any[]).forEach(client => {
      if (client.name?.toLowerCase().includes(query) || client.email?.toLowerCase().includes(query)) {
        results.push({
          id: client.id,
          title: client.name,
          subtitle: client.email,
          type: 'client',
          href: `/clients/${client.id}`,
        });
      }
    });

    (invoices as any[]).forEach(invoice => {
      if (invoice.invoiceNumber?.toLowerCase().includes(query)) {
        results.push({
          id: invoice.id,
          title: invoice.invoiceNumber,
          subtitle: `${invoice.amount} ج.م - ${invoice.status}`,
          type: 'invoice',
          href: `/invoices/${invoice.id}`,
        });
      }
    });

    (tasks as any[]).forEach(task => {
      if (task.title?.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query)) {
        results.push({
          id: task.id,
          title: task.title,
          subtitle: task.status,
          type: 'task',
          href: `/tasks?task=${task.id}`,
        });
      }
    });

    return results.slice(0, 8);
  };

  const searchResults = getSearchResults();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'client': return Users;
      case 'invoice': return Receipt;
      case 'task': return CheckSquare;
      case 'quotation': return FileText;
      case 'expense': return CreditCard;
      default: return FileText;
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const closeSearch = () => {
    setShowSearchResults(false);
    setSearchQuery("");
  };

  const renderResults = () => {
    if (!showSearchResults || searchQuery.length < 2) return null;
    return (
      <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg">
        {searchResults.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
        ) : (
          searchResults.map((result) => {
            const Icon = getTypeIcon(result.type);
            return (
              <Link key={`${result.type}-${result.id}`} href={result.href} onClick={closeSearch}>
                <div className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-accent">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{result.title}</p>
                    {result.subtitle && <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{t(`search.${result.type}s`)}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    );
  };

  const searchInput = (autoFocus = false) => (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
      <Input
        type="search"
        autoFocus={autoFocus}
        placeholder={t('common.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowSearchResults(e.target.value.length > 0);
        }}
        className="h-9 w-full ps-9"
        onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
        onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
      />
      {renderResults()}
    </div>
  );

  return (
    <header className="border-b border-border bg-card">
      <div className="flex h-14 items-center gap-2 px-3 md:px-5">
        <button
          className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          onClick={onMenuClick}
          aria-label={t('nav.open_menu')}
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2.5 md:w-[13.5rem]">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="hidden whitespace-nowrap text-sm font-semibold text-foreground sm:block">{companyName}</span>
        </Link>

        <div className="relative mx-auto hidden w-full max-w-md md:block">{searchInput()}</div>

        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 md:hidden"
            aria-label={t('common.searchPlaceholder')}
            onClick={() => setShowMobileSearch((prev) => !prev)}
          >
            <Search className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Language">
                <Languages className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => changeLanguage('en')} className="justify-between gap-6">
                English {language === 'en' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('ar')} className="justify-between gap-6">
                العربية {language === 'ar' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <NotificationDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage
                    src={userAvatarSrc(currentUser as any)}
                    alt={getUserDisplayName()}
                  />
                  <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{getUserDisplayName()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="me-2 h-4 w-4" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showMobileSearch && (
        <div className="relative border-t border-border bg-card px-3 py-2 md:hidden">{searchInput(true)}</div>
      )}
    </header>
  );
}
