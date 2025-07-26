import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataExportButtonProps {
  data: any[];
  filename: string;
  type: 'csv' | 'json';
}

export function DataExportButton({ data, filename, type }: DataExportButtonProps) {
  const { toast } = useToast();

  const exportData = () => {
    try {
      let content: string;
      let mimeType: string;

      if (type === 'csv') {
        if (data.length === 0) {
          toast({
            title: "No data to export",
            description: "There are no records to export.",
            variant: "destructive",
          });
          return;
        }

        // Get headers from first object
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        
        // Convert data to CSV rows
        const csvRows = data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values that might contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
          }).join(',')
        );
        
        content = [csvHeaders, ...csvRows].join('\n');
        mimeType = 'text/csv';
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${type}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Data exported as ${filename}.${type}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={exportData}
      className="flex items-center space-x-1"
    >
      <Download className="w-4 h-4" />
      <span>Export</span>
    </Button>
  );
}