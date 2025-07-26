import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  Upload,
  X,
  Receipt,
  CreditCard,
  Tag,
  FileText,
  DollarSign
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const expenseFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(["fixed", "variable"]),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]),
  categoryId: z.string().min(1, "Category is required"),
  expenseDate: z.date(),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "bank_transfer", "check"]),
  isRecurring: z.boolean().default(false),
  projectId: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  expense?: any;
  onClose: () => void;
}

export function ExpenseForm({ expense, onClose }: ExpenseFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: categories } = useQuery({
    queryKey: ["/api/expense-categories"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: expense?.title || "",
      description: expense?.description || "",
      amount: expense?.amount || "",
      type: expense?.type || "variable",
      status: expense?.status || "pending",
      categoryId: expense?.categoryId || "",
      expenseDate: expense ? new Date(expense.expenseDate) : new Date(),
      paymentMethod: expense?.paymentMethod || "credit_card",
      isRecurring: expense?.isRecurring || false,
      projectId: expense?.projectId || "none",
    },
  });

  const expenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      // Validate that file is selected for new expenses
      if (!expense && !selectedFile) {
        throw new Error("Please select a receipt or attachment file");
      }

      // Determine attachment type based on file
      let attachmentType = expense?.attachmentType || 'receipt';
      if (selectedFile) {
        if (selectedFile.type.startsWith('image/')) {
          attachmentType = 'receipt';
        } else if (selectedFile.type === 'application/pdf') {
          attachmentType = 'invoice';
        } else {
          attachmentType = 'other';
        }
      }

      const payload = {
        title: data.title,
        description: data.description,
        amount: parseFloat(data.amount),
        categoryId: data.categoryId,
        type: data.type,
        expenseDate: data.expenseDate, // Keep as Date object
        paymentMethod: data.paymentMethod,
        status: data.status,
        isRecurring: data.isRecurring,
        attachmentUrl: selectedFile ? `/uploads/${selectedFile.name}` : expense?.attachmentUrl || "/uploads/default-receipt.pdf",
        attachmentType,
        relatedClientId: data.projectId === "none" ? null : data.projectId,
      };

      console.log("Expense payload being sent:", payload);

      if (expense) {
        return await apiRequest("PUT", `/api/expenses/${expense.id}`, payload);
      } else {
        return await apiRequest("POST", "/api/expenses", payload);
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: expense ? "Expense updated successfully" : "Expense created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      
      if (expense) {
        queryClient.invalidateQueries({ queryKey: ["/api/expenses", expense.id] });
        setLocation(`/expenses/${expense.id}`);
      } else {
        // Ensure we have a valid expense ID from the response
        const newExpenseId = data?.id || (data as any)?.id;
        if (newExpenseId) {
          setLocation(`/expenses/${newExpenseId}`);
        }
      }
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save expense",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image (JPEG, PNG, GIF) or PDF file",
          variant: "destructive",
        });
        return;
      }

      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const onSubmit = (data: ExpenseFormData) => {
    // Check for attachment before submitting
    if (!expense && !selectedFile) {
      toast({
        title: "Missing Attachment",
        description: "Please select a receipt or attachment file before submitting",
        variant: "destructive",
      });
      return;
    }
    
    expenseMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter expense title..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      className="pl-10"
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Array.isArray(categories) && categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Expense Date */}
          <FormField
            control={form.control}
            name="expenseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expense Date *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Payment Method */}
          <FormField
            control={form.control}
            name="paymentMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Project (Optional) */}
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No Project</SelectItem>
                    {Array.isArray(clients) && clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter expense description..."
                  className="min-h-[100px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recurring Checkbox */}
        <FormField
          control={form.control}
          name="isRecurring"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Recurring Expense
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  Mark this expense as recurring (monthly)
                </p>
              </div>
            </FormItem>
          )}
        />

        {/* File Upload */}
        <div className="space-y-4">
          <Label>Receipt/Attachment *</Label>
          
          {!selectedFile && !expense?.attachmentUrl ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Receipt
              </h3>
              <p className="text-gray-500 mb-4">
                Attach receipt, invoice, or supporting document
              </p>
              <div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Supported formats: JPEG, PNG, GIF, PDF (max 5MB)
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Receipt className="h-8 w-8 text-green-600" />
                  <div>
                    <div className="font-medium">
                      {selectedFile?.name || "Current attachment"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedFile ? 
                        `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 
                        "Existing file"
                      }
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={expenseMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {expenseMutation.isPending ? (
              expense ? "Updating..." : "Creating..."
            ) : (
              expense ? "Update Expense" : "Create Expense"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}