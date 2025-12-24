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
import { useQuery } from "@tanstack/react-query";
import { NotificationDropdown } from "../notifications/NotificationDropdown";
import { 
  Search, 
  Languages, 
  LogOut, 
  User,
  Building2,
  Receipt,
  Users,
  CheckSquare,
  FileText,
  CreditCard
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

export function Navbar() {
  const { t, language, changeLanguage } = useTranslation();
  const { user, logoutMutation } = useAuth();
  const { companyName } = useConfig();
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const currentUser = user as UserType | undefined;

  // Get user's display name and initials
  const getUserDisplayName = () => {
    // Check if user has employee data with name
    if (currentUser && 'employee' in currentUser && currentUser.employee) {
      const employee = currentUser.employee as any;
      if (employee.firstName && employee.lastName) {
        return `${employee.firstName} ${employee.lastName}`;
      }
    }
    // Fallback to firstName/lastName from user directly
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName} ${currentUser.lastName}`;
    }
    return currentUser?.email?.split('@')[0] || 'User';
  };

  const getUserInitials = () => {
    // Check if user has employee data with name
    if (currentUser && 'employee' in currentUser && currentUser.employee) {
      const employee = currentUser.employee as any;
      if (employee.firstName && employee.lastName) {
        return `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
      }
    }
    // Fallback to firstName/lastName from user directly
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    }
    const email = currentUser?.email || 'User';
    return email[0].toUpperCase() + (email[1] || '').toUpperCase();
  };

  // Fetch data for search functionality
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: searchQuery.length > 0,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
    enabled: searchQuery.length > 0,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["/api/tasks"],
    enabled: searchQuery.length > 0,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["/api/quotations"],
    enabled: searchQuery.length > 0,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["/api/expenses"],
    enabled: searchQuery.length > 0,
  });



  // Search functionality
  const getSearchResults = (): SearchResult[] => {
    if (!searchQuery || searchQuery.length < 2) return [];

    const results: SearchResult[] = [];
    const query = searchQuery.toLowerCase();

    // Search clients
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

    // Search invoices
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

    // Search tasks
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

    return results.slice(0, 8); // Limit to 8 results
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

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-4">
          <Link href="/">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="text-white text-sm" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">{companyName}</h1>
            </div>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-8 relative">
          <div className="relative">
            <Search className={cn(
              "absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4",
              language === 'ar' ? 'right-3' : 'left-3'
            )} />
            <Input
              type="text"
              placeholder={t('common.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(e.target.value.length > 0);
              }}
              className={cn(
                "w-full",
                language === 'ar' ? 'pr-10 text-right' : 'pl-10'
              )}
              onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            />
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <Card className="absolute top-full mt-2 w-full z-50 shadow-lg">
              <CardContent className="p-2">
                {searchResults.map((result) => {
                  const Icon = getTypeIcon(result.type);
                  return (
                    <Link key={result.id} href={result.href}>
                      <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-xs text-gray-500">{result.subtitle}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {t(`search.${result.type}s`)}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
                {searchResults.length === 8 && (
                  <div className="text-center py-2">
                    <span className="text-xs text-gray-500">{t('common.viewAll')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No Results */}
          {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && (
            <Card className="absolute top-full mt-2 w-full z-50 shadow-lg">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-gray-500">{t('common.noResults')}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-4">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Languages className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => changeLanguage('en')}>
                <span className={cn("flex items-center", language === 'en' && "font-semibold")}>
                  🇺🇸 English
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('ar')}>
                <span className={cn("flex items-center", language === 'ar' && "font-semibold")}>
                  🇸🇦 العربية
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <NotificationDropdown />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-3 gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage 
                    src={currentUser?.profileImageUrl || (currentUser && 'employee' in currentUser && currentUser.employee ? (currentUser.employee as any).profileImage : undefined)} 
                    alt={getUserDisplayName()}
                  />
                  <AvatarFallback className="text-xs font-medium bg-primary text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {getUserDisplayName()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}