import { useQuery } from "@tanstack/react-query";

interface SidebarCountersProps {
  currentPath: string;
}

interface CountersData {
  clients?: number;
  quotations?: number;
  invoices?: number;
  expenses?: number;
  employees?: number;
  tasks?: number;
}

export function SidebarCounters({ currentPath }: SidebarCountersProps) {
  const { data: counters } = useQuery<CountersData>({
    queryKey: ["/api/sidebar/counters"],
    staleTime: 30000, // Refresh every 30 seconds
  });

  const getCountForPath = (path: string): number => {
    if (!counters) return 0;
    
    switch (path) {
      case '/crm':
        return counters.clients || 0;
      case '/quotations':
        return counters.quotations || 0;
      case '/invoices':
        return counters.invoices || 0;
      case '/expenses':
        return counters.expenses || 0;
      case '/employees':
        return counters.employees || 0;
      case '/tasks':
        return counters.tasks || 0;
      default:
        return 0;
    }
  };

  const count = getCountForPath(currentPath);
  
  if (count === 0) return null;

  return (
    <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
      {count}
    </span>
  );
}