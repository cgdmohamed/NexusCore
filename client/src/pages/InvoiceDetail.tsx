import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getCsrfToken } from "@/lib/queryClient";
import { useTranslation } from "@/lib/i18n";
import { isInvoiceOverdue } from "@/lib/invoice-status";
import { usePermissions } from "@/hooks/usePermissions";
import { PaymentSourceSelect } from "@/components/forms/PaymentSourceSelect";
import { useParams, Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft,
  Edit,
  Send,
  DollarSign,
  Calendar,
  User,
  FileText,
  Plus,
  Trash2,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  Percent,
  Receipt,
  Paperclip,
  Upload,
  File,
  Image,
  X,
  Ban,
  History,
  QrCode,
  Sparkles,
  Printer,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format, formatDistanceToNow } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Invoice, InvoiceItem, Payment, Client, InvoiceHistory } from "@shared/schema";

interface InvoiceItemFormData {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface PaymentFormData {
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  bankTransferNumber: string;
  notes: string;
  adminApproved: boolean;
  paymentSourceId: string;
}

const VAT_RATE = 15;

export default function InvoiceDetail() {
  const { t } = useTranslation();
  const { canEdit, canApprove } = usePermissions();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [itemForm, setItemForm] = useState<InvoiceItemFormData>({
    name: '',
    description: '',
    quantity: 1,
    unitPrice: 0
  });
  const [editItemForm, setEditItemForm] = useState<InvoiceItemFormData>({
    name: '',
    description: '',
    quantity: 1,
    unitPrice: 0
  });
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    bankTransferNumber: '',
    notes: '',
    adminApproved: false,
    paymentSourceId: ''
  });
  const [overpaymentWarning, setOverpaymentWarning] = useState<any>(null);
  const [showCreditInfo, setShowCreditInfo] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [, navigate] = useLocation();
  const [refundForm, setRefundForm] = useState({
    refundAmount: "",
    refundMethod: "",
    refundReference: "",
    refundSourceId: "",
    notes: ""
  });
  const [assigningPayment, setAssigningPayment] = useState<any>(null);
  const [assignSourceId, setAssignSourceId] = useState("");
  const [taxDiscountForm, setTaxDiscountForm] = useState({
    applyVat: false,
    applyDiscount: false,
    discountType: "percentage" as "percentage" | "amount",
    discountValue: ""
  });
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Print dialog state
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printHistoryOpen, setPrintHistoryOpen] = useState(false);
  const [printCurrency, setPrintCurrency] = useState("EGP");
  const [printRate, setPrintRate] = useState("1");
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: invoice, isLoading: invoiceLoading } = useQuery<Invoice>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id,
  });

  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: [`/api/invoices/${id}/items`],
    enabled: !!id,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: [`/api/invoices/${id}/payments`],
    enabled: !!id,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: clientCredit } = useQuery({
    queryKey: [`/api/clients/${invoice?.clientId}/credit`],
    enabled: !!invoice?.clientId,
  });

  const { data: invoiceHistoryData = [] } = useQuery<InvoiceHistory[]>({
    queryKey: [`/api/invoices/${id}/history`],
    enabled: !!id,
  });

  const qrFileInputRef = useRef<HTMLInputElement>(null);

  const { data: printRecords = [] } = useQuery<any[]>({
    queryKey: [`/api/invoices/${id}/print-records`],
    enabled: !!id,
  });

  const handlePrint = async () => {
    const rate = printCurrency === "EGP" ? 1 : parseFloat(printRate);
    if (printCurrency !== "EGP" && (isNaN(rate) || rate <= 0)) {
      toast({ title: "Invalid rate", description: "Exchange rate must be greater than 0.", variant: "destructive" });
      return;
    }
    setIsPrinting(true);
    try {
      const res = await apiRequest("POST", `/api/invoices/${id}/print`, {
        displayCurrency: printCurrency,
        exchangeRate: rate.toString(),
      });
      const data = await res.json();
      setIsPrintDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/print-records`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      window.open(data.printUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Print failed", description: err.message || "Failed to create print record.", variant: "destructive" });
    } finally {
      setIsPrinting(false);
    }
  };

  // Initialize tax/discount form when invoice loads or updates
  useEffect(() => {
    if (invoice) {
      const hasVat = parseFloat(invoice.taxRate || "0") > 0;
      const hasDiscount = parseFloat(invoice.discountAmount || "0") > 0 || parseFloat(invoice.discountRate || "0") > 0;
      const discountRate = parseFloat(invoice.discountRate || "0");
      
      setTaxDiscountForm({
        applyVat: hasVat,
        applyDiscount: hasDiscount,
        discountType: discountRate > 0 ? "percentage" : "amount",
        discountValue: discountRate > 0 
          ? discountRate.toString() 
          : (parseFloat(invoice.discountAmount || "0")).toString()
      });
    }
  }, [invoice?.id, invoice?.taxRate, invoice?.taxAmount, invoice?.discountRate, invoice?.discountAmount]);

  const applyCreditMutation = useMutation({
    mutationFn: async (creditAmount: number) => {
      return apiRequest("POST", `/api/invoices/${id}/apply-credit`, {
        clientId: invoice?.clientId,
        creditAmount: creditAmount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${invoice?.clientId}/credit`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      setShowCreditInfo(false);
      toast({
        title: "Success",
        description: "Client credit applied to invoice successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to apply credit to invoice",
        variant: "destructive",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (itemData: InvoiceItemFormData) => {
      return apiRequest("POST", `/api/invoices/${id}/items`, itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/items`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      setIsAddingItem(false);
      setItemForm({ name: '', description: '', quantity: 1, unitPrice: 0 });
      toast({
        title: "Success",
        description: "Invoice item added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add invoice item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { itemId: string; itemData: InvoiceItemFormData }) => {
      return apiRequest("PATCH", `/api/invoices/${id}/items/${data.itemId}`, data.itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/items`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      setIsEditingItem(false);
      setEditingItemId(null);
      setEditItemForm({ name: '', description: '', quantity: 1, unitPrice: 0 });
      toast({
        title: "Success",
        description: "Invoice item updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update invoice item",
        variant: "destructive",
      });
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentFormData) => {
      return apiRequest("POST", `/api/invoices/${id}/payments`, paymentData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${invoice?.clientId}/credit`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
      setIsAddingPayment(false);
      setOverpaymentWarning(null);
      setPaymentForm({
        amount: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        bankTransferNumber: '',
        notes: '',
        adminApproved: false,
        paymentSourceId: ''
      });
      
      let message = "Payment recorded successfully";
      if ((data as any)?.overpaymentHandled && (data as any)?.creditAdded > 0) {
        message += `. ${formatCurrency((data as any).creditAdded)} added to client credit balance.`;
      }
      
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error: any) => {
      if (error.message.includes('OVERPAYMENT_DETECTED')) {
        try {
          const errorData = JSON.parse(error.message.split('400: ')[1]);
          setOverpaymentWarning(errorData);
        } catch {
          setOverpaymentWarning({
            message: error.message,
            details: { overpaymentAmount: 0 }
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to record payment",
          variant: "destructive",
        });
      }
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/invoices/${id}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/items`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      toast({
        title: "Success",
        description: "Invoice item removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove invoice item",
        variant: "destructive",
      });
    },
  });

  const assignSourceMutation = useMutation({
    mutationFn: async ({ paymentId, paymentSourceId }: { paymentId: string; paymentSourceId: string }) =>
      apiRequest("PATCH", `/api/payments/${paymentId}/source`, { paymentSourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
      setAssigningPayment(null);
      setAssignSourceId("");
      toast({ title: t("paysrc.assigned") });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to assign the account", variant: "destructive" });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (refundData: any) => {
      return apiRequest("POST", `/api/invoices/${id}/refund`, refundData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${invoice?.clientId}/credit`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
      
      setIsProcessingRefund(false);
      setRefundForm({
        refundAmount: "",
        refundMethod: "",
        refundReference: "",
        refundSourceId: "",
        notes: ""
      });
      
      toast({
        title: "Refund Processed",
        description: `Successfully processed refund of ${refundForm.refundAmount} EGP`,
      });
    },
    onError: (error: any) => {
      console.error("Refund error:", error);
      toast({
        title: "Refund Failed",
        description: error.message || "Failed to process refund",
        variant: "destructive",
      });
    }
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${id}/cancel`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to cancel invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      setShowCancelConfirm(false);
      toast({
        title: "Invoice Cancelled",
        description: "The invoice has been cancelled and excluded from revenue calculations.",
      });
    },
    onError: (error: any) => {
      setShowCancelConfirm(false);
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel invoice.",
        variant: "destructive",
      });
    }
  });

  // Issuing (draft -> sent) and taking an unpaid invoice back to draft
  const statusMutation = useMutation({
    mutationFn: async (status: "sent" | "draft") => {
      await apiRequest("PATCH", `/api/invoices/${id}/status`, { status });
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      toast({ title: t(status === "sent" ? "inv.issued_toast" : "inv.returned_toast") });
    },
    onError: (error: Error) => {
      toast({ title: t("inv.status_failed"), description: error.message, variant: "destructive" });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Get CSRF token for the request
      const token = await getCsrfToken();
      
      const response = await fetch(`/api/invoices/${id}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'x-csrf-token': token,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload attachment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      toast({
        title: "File Uploaded",
        description: "The attachment has been uploaded successfully.",
      });
      setIsUploadingFile(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload attachment",
        variant: "destructive",
      });
      setIsUploadingFile(false);
    }
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentPath: string) => {
      return apiRequest("DELETE", `/api/invoices/${id}/attachments`, { attachmentPath });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      toast({
        title: "Attachment Deleted",
        description: "The attachment has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete attachment",
        variant: "destructive",
      });
    }
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/invoices/${id}/recalculate`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      toast({
        title: "Invoice Recalculated",
        description: data?.message || "Invoice totals and status have been recalculated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Recalculation Failed",
        description: error.message || "Failed to recalculate invoice",
        variant: "destructive",
      });
    }
  });

  const updateTaxDiscountMutation = useMutation({
    mutationFn: async (data: { taxRate: string; taxAmount: string; discountRate: string; discountAmount: string; amount: string; subtotal: string }) => {
      return apiRequest("PATCH", `/api/invoices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      toast({
        title: "Invoice Updated",
        description: "Tax and discount settings have been updated.",
      });
    },
    onError: (error: any) => {
      console.error("Update tax/discount error:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update tax and discount",
        variant: "destructive",
      });
    }
  });

  const generateQrCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${id}/qr-code`, { generate: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      toast({ title: "QR Code Generated", description: "QR code has been generated and saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate QR code", variant: "destructive" });
    },
  });

  const uploadQrCodeMutation = useMutation({
    mutationFn: async (file: File) => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const imageData = e.target?.result as string;
            const res = await apiRequest("POST", `/api/invoices/${id}/qr-code`, { imageData });
            if (!res.ok) {
              const err = await res.json();
              reject(new Error(err.message || "Upload failed"));
            } else {
              resolve();
            }
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      toast({ title: "QR Code Uploaded", description: "Custom QR code has been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message || "Failed to upload QR code", variant: "destructive" });
    },
  });

  const removeQrCodeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/invoices/${id}/qr-code`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/history`] });
      toast({ title: "QR Code Removed", description: "The QR code has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove QR code", variant: "destructive" });
    },
  });

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadQrCodeMutation.mutate(file, {
      onSettled: () => { e.target.value = ''; }
    });
  };

  const handleRefund = () => {
    const refundAmount = parseFloat(refundForm.refundAmount);
    
    if (!refundAmount || refundAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid refund amount",
        variant: "destructive"
      });
      return;
    }

    if (refundAmount > paidAmount) {
      toast({
        title: "Amount Exceeds Limit",
        description: `Refund amount cannot exceed paid amount (${paidAmount} EGP)`,
        variant: "destructive"
      });
      return;
    }

    if (!refundForm.refundMethod) {
      toast({
        title: "Missing Method",
        description: "Please select a refund method",
        variant: "destructive"
      });
      return;
    }

    refundMutation.mutate({
      refundAmount: refundAmount,
      refundMethod: refundForm.refundMethod,
      refundReference: refundForm.refundReference,
      refundSourceId: refundForm.refundSourceId,
      notes: refundForm.notes
    });
  };

  if (invoiceLoading) {
    return (
      <div>
        <Header title="Loading..." subtitle="Please wait" />
        <div className="p-6 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <Header title="Invoice Not Found" subtitle="The requested invoice could not be found" />
        <div className="p-6 text-center">
          <FileText className="w-16 h-16 text-muted-foreground/70 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Invoice not found</p>
          <Link href="/invoices">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 me-2 rtl:-scale-x-100" />
              Back to Invoices
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const client = clients.find(c => c.id === invoice.clientId);
  const subtotal = invoiceItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
  const taxAmount = parseFloat(invoice.taxAmount || "0");
  const discountAmount = parseFloat(invoice.discountAmount || "0");
  const totalAmount = subtotal + taxAmount - discountAmount;
  const paidAmount = parseFloat(invoice.paidAmount || "0");
  const remainingAmount = totalAmount - paidAmount;
  const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-success-soft text-success border-success/20';
      case 'partially_paid': return 'bg-info-soft text-info border-info/20';
      case 'sent': return 'bg-warning-soft text-warning border-warning/20';
      case 'draft': return 'bg-muted text-foreground border-border';
      case 'overdue': return 'bg-danger-soft text-danger border-danger/20';
      case 'cancelled': return 'bg-muted text-muted-foreground border-border';
      case 'refunded': return 'bg-info-soft text-info border-info/20';
      case 'partially_refunded': return 'bg-warning-soft text-warning border-warning/20';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'partially_paid': return <CreditCard className="w-4 h-4" />;
      case 'sent': return <FileText className="w-4 h-4" />;
      case 'draft': return <Edit className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <Ban className="w-4 h-4" />;
      case 'refunded': return <RotateCcw className="w-4 h-4" />;
      case 'partially_refunded': return <RefreshCw className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleAddItem = () => {
    if (!itemForm.name.trim()) return;
    addItemMutation.mutate(itemForm);
  };

  const handleAddPayment = () => {
    if (paymentForm.amount <= 0) return;
    setOverpaymentWarning(null);
    addPaymentMutation.mutate(paymentForm);
  };

  const handleOverpaymentApproval = () => {
    if (!overpaymentWarning) return;
    const approvedPayment = { ...paymentForm, adminApproved: true };
    setOverpaymentWarning(null);
    addPaymentMutation.mutate(approvedPayment);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploadingFile(true);
    uploadAttachmentMutation.mutate(file, {
      onSettled: () => {
        // Reset the file input after upload attempt (success or failure)
        event.target.value = '';
      }
    });
  };

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
      return <Image className="w-5 h-5 text-primary" />;
    }
    return <File className="w-5 h-5 text-muted-foreground" />;
  };

  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  const handleApplyTaxDiscount = () => {
    let taxRate = "0";
    let taxAmountValue = "0";
    let discountRate = "0";
    let discountAmountValue = "0";

    // Calculate tax if VAT is enabled
    if (taxDiscountForm.applyVat) {
      taxRate = VAT_RATE.toString();
      taxAmountValue = ((subtotal * VAT_RATE) / 100).toFixed(2);
    }

    // Calculate discount if enabled
    if (taxDiscountForm.applyDiscount && taxDiscountForm.discountValue) {
      const discountValue = parseFloat(taxDiscountForm.discountValue);
      
      // Validate discount doesn't exceed subtotal
      let calculatedDiscount = 0;
      if (taxDiscountForm.discountType === "percentage") {
        if (discountValue > 100) {
          toast({
            title: "Invalid Discount",
            description: "Discount percentage cannot exceed 100%",
            variant: "destructive"
          });
          return;
        }
        discountRate = discountValue.toString();
        calculatedDiscount = (subtotal * discountValue) / 100;
      } else {
        calculatedDiscount = discountValue;
      }

      if (calculatedDiscount > subtotal) {
        toast({
          title: "Invalid Discount",
          description: "Discount amount cannot exceed the subtotal",
          variant: "destructive"
        });
        return;
      }

      discountAmountValue = calculatedDiscount.toFixed(2);
    }

    // Calculate the new total amount
    const newTaxAmount = parseFloat(taxAmountValue);
    const newDiscountAmount = parseFloat(discountAmountValue);
    const newTotalAmount = (subtotal + newTaxAmount - newDiscountAmount).toFixed(2);

    updateTaxDiscountMutation.mutate({
      taxRate,
      taxAmount: taxAmountValue,
      discountRate,
      discountAmount: discountAmountValue,
      amount: newTotalAmount,
      subtotal: subtotal.toFixed(2)
    });
  };

  const isOverdue = isInvoiceOverdue(invoice);

  return (
    <div>
      <Header 
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`${client?.name || 'Unknown Client'} • ${invoice.status}`}
      />
      
      {invoice.status === "draft" && (
        <div className="mx-3 mt-4 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning md:mx-6">
          {t("inv.draft_notice")}
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-3 pt-4 pb-4 md:px-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/invoices">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 me-2 rtl:-scale-x-100" />
              Back to Invoices
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => setIsPrintDialogOpen(true)}
            data-testid="button-print-invoice"
          >
            <Printer className="w-4 h-4 me-2" />
            Download / Print
          </Button>
          {invoice.status === "draft" && canEdit("invoices") && (
            <Button onClick={() => statusMutation.mutate("sent")} disabled={statusMutation.isPending} data-testid="button-issue-invoice">
              <Send className="w-4 h-4 me-2 rtl:-scale-x-100" />
              {t("inv.issue")}
            </Button>
          )}
          {invoice.status === "sent" && canEdit("invoices") && parseFloat(String(invoice.paidAmount || 0)) === 0 && (
            <Button variant="outline" onClick={() => statusMutation.mutate("draft")} disabled={statusMutation.isPending}>
              {t("inv.return_draft")}
            </Button>
          )}
          
          {/* Recalculate button - to fix existing invoices with wrong totals/status */}
          <Button 
            variant="outline" 
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            data-testid="button-recalculate-invoice"
          >
            <RefreshCw className={`w-4 h-4 me-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            {recalculateMutation.isPending ? "Recalculating..." : "Recalculate"}
          </Button>
          
          {/* Cancel Invoice - invoices are never deleted; cancelling keeps them on record */}
          {['draft', 'pending', 'sent', 'overdue', 'partially_paid'].includes(invoice.status) && (
            <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-warning/20 text-warning hover:bg-warning-soft" data-testid="button-cancel-invoice">
                  <Ban className="w-4 h-4 me-2" />
                  Cancel Invoice
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Invoice {invoice.invoiceNumber}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the invoice as <strong>Cancelled</strong>. The invoice will remain visible for record keeping but no further payments can be recorded and it will be excluded from revenue calculations. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelInvoiceMutation.mutate()}
                    disabled={cancelInvoiceMutation.isPending}
                    className="bg-warning hover:bg-warning"
                    data-testid="button-confirm-cancel"
                  >
                    {cancelInvoiceMutation.isPending ? "Cancelling..." : "Yes, Cancel Invoice"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Cancelled Invoice Banner */}
        {invoice.status === 'cancelled' && (
          <div className="flex items-center gap-3 rounded-lg border border-danger/20 bg-danger-soft p-4 text-danger">
            <Ban className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">This invoice has been cancelled</p>
              <p className="text-sm text-danger">No further payments can be recorded. This invoice is excluded from revenue calculations but remains visible for record keeping.</p>
            </div>
          </div>
        )}

        {/* Invoice Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <FileText className="w-5 h-5 me-2" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Invoice Number</Label>
                <p className="font-semibold">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Badge variant="outline" className={getStatusColor(invoice.status)}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(invoice.status)}
                    <span className="capitalize">{invoice.status.replace('_', ' ')}</span>
                  </div>
                </Badge>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Title</Label>
                <p>{invoice.title || 'No title'}</p>
              </div>
              {invoice.description && (
                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p>{invoice.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <User className="w-5 h-5 me-2" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Client Name</Label>
                <p className="font-semibold">{client?.name || 'Unknown Client'}</p>
              </div>
              {client?.email && (
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p>{client.email}</p>
                </div>
              )}
              {client?.phone && (
                <div>
                  <Label className="text-sm text-muted-foreground">Phone</Label>
                  <p><bdi dir="ltr">{client.phone}</bdi></p>
                </div>
              )}
              {client?.address && (
                <div>
                  <Label className="text-sm text-muted-foreground">Address</Label>
                  <p>{client.address}</p>
                </div>
              )}
              {clientCredit && parseFloat((clientCredit as any)?.currentBalance || "0") > 0 ? (
                <div>
                  <Label className="text-sm text-muted-foreground">Available Credit</Label>
                  <p className="font-semibold text-success">
                    {formatCurrency((clientCredit as any).currentBalance)}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-1"
                    onClick={() => setShowCreditInfo(true)}
                  >
                    View Credit History
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Calendar className="w-5 h-5 me-2" />
                Dates & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Invoice Date</Label>
                <p>{invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'MMM dd, yyyy') : 'Not set'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Due Date</Label>
                <p className={isOverdue ? 'text-danger font-medium' : ''}>
                  {invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'Not set'}
                  {isOverdue && ' (Overdue)'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Created</Label>
                <p>{invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'Unknown'}</p>
              </div>
              {invoice.paidDate && (
                <div>
                  <Label className="text-sm text-muted-foreground">Paid Date</Label>
                  <p>{format(new Date(invoice.paidDate), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <DollarSign className="w-5 h-5 me-2" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Prominent Invoice Total */}
            <div className="bg-card p-6 rounded-lg border mb-6">
              <div className="text-center">
                <Label className="text-sm text-muted-foreground font-medium">Invoice Total</Label>
                <p className="text-4xl font-semibold tracking-tight tabular-nums mt-2">{formatCurrency(totalAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-card p-4 rounded-lg border">
                <Label className="text-sm text-muted-foreground">Subtotal</Label>
                <p className="text-xl font-semibold tabular-nums">{formatCurrency(subtotal)}</p>
              </div>
              <div className="bg-card p-4 rounded-lg border">
                <Label className="text-sm text-muted-foreground">VAT ({parseFloat(invoice.taxRate || "0")}%)</Label>
                <p className="text-xl font-semibold tabular-nums">+{formatCurrency(taxAmount)}</p>
              </div>
              <div className="bg-card p-4 rounded-lg border">
                <Label className="text-sm text-muted-foreground">Discount</Label>
                <p className="text-xl font-semibold tabular-nums">-{formatCurrency(discountAmount)}</p>
              </div>
              <div className="bg-success-soft p-4 rounded-lg border border-success/20">
                <Label className="text-sm text-success font-medium">Paid Amount</Label>
                <p className="text-xl font-semibold tabular-nums text-success">{formatCurrency(paidAmount)}</p>
              </div>
              <div className="bg-danger-soft p-4 rounded-lg border border-danger/20">
                <Label className="text-sm text-danger font-medium">Outstanding</Label>
                <p className="text-xl font-semibold tabular-nums text-danger">{formatCurrency(remainingAmount)}</p>
              </div>
            </div>
            
            {/* Payment Progress */}
            <div className="mt-6 bg-card p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm text-muted-foreground font-medium">Payment Progress</Label>
                <span className="text-lg font-semibold tabular-nums">{paymentProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-4">
                <div 
                  className="bg-success h-4 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span className="font-medium">Paid: {formatCurrency(paidAmount)}</span>
                <span className="font-medium">Remaining: {formatCurrency(remainingAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax & Discount Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Receipt className="w-5 h-5 me-2" />
              Tax & Discount Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VAT Toggle */}
              <div className="bg-muted/50 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-base font-medium">Apply VAT ({VAT_RATE}%)</Label>
                    <p className="text-sm text-muted-foreground">Add {VAT_RATE}% Value Added Tax to the subtotal</p>
                  </div>
                  <Switch
                    checked={taxDiscountForm.applyVat}
                    onCheckedChange={(checked) => setTaxDiscountForm(prev => ({ ...prev, applyVat: checked }))}
                    data-testid="switch-apply-vat"
                  />
                </div>
                {taxDiscountForm.applyVat && (
                  <div className="mt-3 p-3 bg-info-soft rounded border border-info/20">
                    <p className="text-sm text-info">
                      VAT Amount: <span className="font-bold">{formatCurrency((subtotal * VAT_RATE) / 100)}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Discount Toggle */}
              <div className="bg-muted/50 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-base font-medium">Apply Discount</Label>
                    <p className="text-sm text-muted-foreground">Reduce the invoice total with a discount</p>
                  </div>
                  <Switch
                    checked={taxDiscountForm.applyDiscount}
                    onCheckedChange={(checked) => setTaxDiscountForm(prev => ({ ...prev, applyDiscount: checked }))}
                    data-testid="switch-apply-discount"
                  />
                </div>
                {taxDiscountForm.applyDiscount && (
                  <div className="mt-3 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label className="text-sm">Discount Type</Label>
                        <Select
                          value={taxDiscountForm.discountType}
                          onValueChange={(value: "percentage" | "amount") => 
                            setTaxDiscountForm(prev => ({ ...prev, discountType: value }))
                          }
                        >
                          <SelectTrigger data-testid="select-discount-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="amount">Fixed Amount (EGP)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-sm">
                          {taxDiscountForm.discountType === "percentage" ? "Discount %" : "Discount Amount"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={taxDiscountForm.discountType === "percentage" ? "e.g. 10" : "e.g. 500"}
                          value={taxDiscountForm.discountValue}
                          onChange={(e) => setTaxDiscountForm(prev => ({ ...prev, discountValue: e.target.value }))}
                          data-testid="input-discount-value"
                        />
                      </div>
                    </div>
                    {taxDiscountForm.discountValue && (
                      <div className="p-3 bg-warning-soft rounded border border-warning/20">
                        <p className="text-sm text-warning">
                          Discount Amount: <span className="font-bold">
                            {formatCurrency(
                              taxDiscountForm.discountType === "percentage"
                                ? (subtotal * parseFloat(taxDiscountForm.discountValue || "0")) / 100
                                : parseFloat(taxDiscountForm.discountValue || "0")
                            )}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 p-4 bg-info-soft border border-info/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-info">Save Tax & Discount Settings</p>
                  <p className="text-sm text-info">Click the button to save your changes to this invoice</p>
                </div>
                <Button 
                  onClick={handleApplyTaxDiscount}
                  disabled={updateTaxDiscountMutation.isPending}
                  size="lg"
                  className="bg-info hover:bg-info"
                  data-testid="button-apply-tax-discount"
                >
                  {updateTaxDiscountMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Invoice Items</CardTitle>
              <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 me-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Invoice Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="itemName">Item Name</Label>
                      <Input
                        id="itemName"
                        value={itemForm.name}
                        onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter item name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="itemDescription">Description</Label>
                      <Textarea
                        id="itemDescription"
                        value={itemForm.description}
                        onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter item description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={itemForm.quantity}
                          onChange={(e) => setItemForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="unitPrice">Unit Price</Label>
                        <Input
                          id="unitPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemForm.unitPrice}
                          onChange={(e) => setItemForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Total: ${(itemForm.quantity * itemForm.unitPrice).toFixed(2)}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        onClick={handleAddItem} 
                        disabled={!itemForm.name.trim() || addItemMutation.isPending}
                        className="flex-1"
                      >
                        {addItemMutation.isPending ? "Adding..." : "Add Item"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddingItem(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {invoiceItems.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No items added to this invoice</p>
                <Button onClick={() => setIsAddingItem(true)}>
                  <Plus className="w-4 h-4 me-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <div className="rounded-md border min-w-[560px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-end">Quantity</TableHead>
                      <TableHead className="text-end">Unit Price</TableHead>
                      <TableHead className="text-end">Total</TableHead>
                      <TableHead className="text-end">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.description || '-'}</TableCell>
                        <TableCell className="text-end">{item.quantity}</TableCell>
                        <TableCell className="text-end">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-end font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setEditItemForm({
                                  name: item.name,
                                  description: item.description || '',
                                  quantity: typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity,
                                  unitPrice: parseFloat(item.unitPrice)
                                });
                                setIsEditingItem(true);
                              }}
                              data-testid={`button-edit-item-${item.id}`}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                              disabled={deleteItemMutation.isPending}
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </div>
            )}

            {/* Edit Item Dialog */}
            <Dialog open={isEditingItem} onOpenChange={(open) => {
              setIsEditingItem(open);
              if (!open) {
                setEditingItemId(null);
                setEditItemForm({ name: '', description: '', quantity: 1, unitPrice: 0 });
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Invoice Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="editItemName">Item Name *</Label>
                    <Input
                      id="editItemName"
                      value={editItemForm.name}
                      onChange={(e) => setEditItemForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter item name"
                      data-testid="input-edit-item-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editItemDescription">Description</Label>
                    <Textarea
                      id="editItemDescription"
                      value={editItemForm.description}
                      onChange={(e) => setEditItemForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter item description"
                      data-testid="input-edit-item-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="editItemQuantity">Quantity</Label>
                      <Input
                        id="editItemQuantity"
                        type="number"
                        min="1"
                        value={editItemForm.quantity}
                        onChange={(e) => setEditItemForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        data-testid="input-edit-item-quantity"
                      />
                    </div>
                    <div>
                      <Label htmlFor="editItemUnitPrice">Unit Price (EGP)</Label>
                      <Input
                        id="editItemUnitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editItemForm.unitPrice}
                        onChange={(e) => setEditItemForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-edit-item-unitprice"
                      />
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Total: <span className="font-bold">{formatCurrency((editItemForm.quantity * editItemForm.unitPrice).toString())}</span>
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => {
                        if (editingItemId) {
                          updateItemMutation.mutate({ itemId: editingItemId, itemData: editItemForm });
                        }
                      }}
                      disabled={!editItemForm.name.trim() || updateItemMutation.isPending}
                      className="flex-1"
                      data-testid="button-save-item"
                    >
                      {updateItemMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditingItem(false);
                      setEditingItemId(null);
                      setEditItemForm({ name: '', description: '', quantity: 1, unitPrice: 0 });
                    }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Payment Records */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Payment Records</CardTitle>
              <div className="flex gap-2">
                {paidAmount > 0 && (
                  <Dialog open={isProcessingRefund} onOpenChange={setIsProcessingRefund}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <RotateCcw className="w-4 h-4 me-2" />
                        Process Refund
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Process Invoice Refund</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="refundAmount">Refund Amount (EGP)</Label>
                          <Input
                            id="refundAmount"
                            type="number"
                            min="0.01"
                            max={paidAmount}
                            step="0.01"
                            value={refundForm.refundAmount}
                            onChange={(e) => setRefundForm(prev => ({ ...prev, refundAmount: e.target.value }))}
                            placeholder="0.00"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            Maximum refundable: {paidAmount} EGP
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="refundMethod">Refund Method</Label>
                          <select
                            id="refundMethod"
                            value={refundForm.refundMethod}
                            onChange={(e) => setRefundForm(prev => ({ ...prev, refundMethod: e.target.value }))}
                            className="w-full p-2 border border-input rounded-md"
                          >
                            <option value="">Select refund method</option>
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="credit_card">Credit Card Reversal</option>
                            <option value="check">Check</option>
                          </select>
                        </div>
                        <PaymentSourceSelect
                          id="refund-source"
                          label={t("paysrc.refund_from")}
                          value={refundForm.refundSourceId}
                          onChange={(v) => setRefundForm(prev => ({ ...prev, refundSourceId: v }))}
                          suggestFor={refundForm.refundMethod}
                        />
                        <div>
                          <Label htmlFor="refundReference">Reference Number (Optional)</Label>
                          <Input
                            id="refundReference"
                            value={refundForm.refundReference}
                            onChange={(e) => setRefundForm(prev => ({ ...prev, refundReference: e.target.value }))}
                            placeholder="Transaction/Reference number"
                          />
                        </div>
                        <div>
                          <Label htmlFor="refundNotes">Notes (Optional)</Label>
                          <Textarea
                            id="refundNotes"
                            value={refundForm.notes}
                            onChange={(e) => setRefundForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Additional notes about this refund..."
                            rows={3}
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            onClick={handleRefund} 
                            disabled={!refundForm.refundAmount || !refundForm.refundMethod || refundMutation.isPending}
                            className="flex-1"
                          >
                            {refundMutation.isPending ? "Processing..." : "Process Refund"}
                          </Button>
                          <Button variant="outline" onClick={() => setIsProcessingRefund(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Dialog open={isAddingPayment} onOpenChange={setIsAddingPayment}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={invoice.status === 'cancelled'}>
                      <Plus className="w-4 h-4 me-2" />
                      Record Payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="paymentAmount">Payment Amount</Label>
                      <Input
                        id="paymentAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        placeholder="Enter payment amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentDate">Payment Date</Label>
                      <Input
                        id="paymentDate"
                        type="date"
                        value={paymentForm.paymentDate}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentMethod">Payment Method</Label>
                      <select
                        id="paymentMethod"
                        value={paymentForm.paymentMethod}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full p-2 border border-input rounded-md"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <PaymentSourceSelect
                      id="payment-source"
                      value={paymentForm.paymentSourceId}
                      onChange={(v) => setPaymentForm(prev => ({ ...prev, paymentSourceId: v }))}
                      suggestFor={paymentForm.paymentMethod}
                      fallbackToDefault
                    />
                    <div>
                      <Label htmlFor="bankTransferNumber">Reference Number</Label>
                      <Input
                        id="bankTransferNumber"
                        value={paymentForm.bankTransferNumber}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, bankTransferNumber: e.target.value }))}
                        placeholder="Transaction/Reference number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentNotes">Notes</Label>
                      <Textarea
                        id="paymentNotes"
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Payment notes"
                      />
                    </div>
                    {/* Overpayment Warning */}
                    {overpaymentWarning && (
                      <div className="p-4 border border-danger/20 bg-danger-soft rounded-md">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="w-5 h-5 text-danger mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-danger">Overpayment Detected</h4>
                            <p className="text-sm text-danger mt-1">
                              {overpaymentWarning.message}
                            </p>
                            {overpaymentWarning.details && (
                              <div className="text-xs text-danger mt-2 space-y-1">
                                <p>Payment Amount: ${overpaymentWarning.details.paymentAmount}</p>
                                <p>Remaining Balance: ${overpaymentWarning.details.remainingAmount}</p>
                                <p>Overpayment: ${overpaymentWarning.details.overpaymentAmount}</p>
                              </div>
                            )}
                            <div className="flex space-x-2 mt-3">
                              <Button 
                                size="sm"
                                onClick={handleOverpaymentApproval}
                                disabled={addPaymentMutation.isPending}
                              >
                                Approve & Add to Credit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setOverpaymentWarning(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button 
                        onClick={handleAddPayment} 
                        disabled={paymentForm.amount <= 0 || addPaymentMutation.isPending}
                        className="flex-1"
                      >
                        {addPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddingPayment(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No payments recorded for this invoice</p>
                <Button onClick={() => setIsAddingPayment(true)} disabled={invoice.status === 'cancelled'}>
                  <Plus className="w-4 h-4 me-2" />
                  Record First Payment
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <div className="rounded-md border min-w-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>{t("paysrc.col")}</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.paymentDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                            {payment.isOverpayment && (
                              <Badge variant="outline" className="text-xs bg-warning-soft text-warning border-warning/20">
                                Overpayment
                              </Badge>
                            )}
                            {payment.paymentMethod === 'credit_balance' && (
                              <Badge variant="outline" className="text-xs bg-info-soft text-info border-info/20">
                                Credit
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{payment.bankTransferNumber || '-'}</TableCell>
                        <TableCell>
                          {payment.paymentSourceName ? (
                            <span>{payment.paymentSourceName}</span>
                          ) : parseFloat(payment.amount) > 0 && !payment.isRefund && payment.paymentMethod !== 'credit_balance' && canApprove("invoices") ? (
                            <Button variant="outline" size="sm" onClick={() => { setAssigningPayment(payment); setAssignSourceId(""); }} data-testid={`assign-source-${payment.id}`}>
                              {t("paysrc.assign")}
                            </Button>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{payment.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attachments Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Paperclip className="w-5 h-5 me-2" />
                Attachments
              </CardTitle>
              <div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.pdf"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isUploadingFile || uploadAttachmentMutation.isPending}
                  data-testid="button-upload-attachment"
                >
                  {isUploadingFile || uploadAttachmentMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 me-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 me-2" />
                      Upload File
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(!invoice?.attachments || invoice.attachments.length === 0) ? (
              <div className="text-center py-8">
                <Paperclip className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No attachments yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload receipts, contracts, or other documents related to this invoice.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoice.attachments.map((attachment, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/60"
                    data-testid={`attachment-item-${index}`}
                  >
                    <div className="flex items-center space-x-3">
                      {getFileIcon(attachment)}
                      <a 
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                        data-testid={`link-attachment-${index}`}
                      >
                        {getFileName(attachment)}
                      </a>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAttachmentMutation.mutate(attachment)}
                      disabled={deleteAttachmentMutation.isPending}
                      className="text-danger hover:text-danger hover:bg-danger-soft"
                      data-testid={`button-delete-attachment-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


        {/* QR Code Panel */}
        <Card className={!invoice.qrCodeImage ? "print:hidden" : ""} data-testid="card-qr-code">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.qrCodeImage ? (
              <div className="flex flex-col items-center gap-4">
                <div className="border rounded-lg p-3 bg-card inline-block shadow-sm">
                  <img
                    src={invoice.qrCodeImage}
                    alt="Invoice QR Code"
                    className="w-48 h-48 object-contain"
                    data-testid="img-qr-code"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center print:hidden">
                  This QR code encodes information about invoice <strong>{invoice.invoiceNumber}</strong> and will appear on printed/exported invoices.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeQrCodeMutation.mutate()}
                  disabled={removeQrCodeMutation.isPending}
                  className="text-danger hover:text-danger hover:border-danger/20 print:hidden"
                  data-testid="button-remove-qr-code"
                >
                  <X className="w-4 h-4 me-2" />
                  {removeQrCodeMutation.isPending ? "Removing..." : "Remove QR Code"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 print:hidden">
                <QrCode className="w-14 h-14 text-muted-foreground/70 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm mb-6">
                  No QR code attached yet. Generate one automatically or upload a custom image.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => generateQrCodeMutation.mutate()}
                    disabled={generateQrCodeMutation.isPending}
                    data-testid="button-generate-qr-code"
                  >
                    <Sparkles className="w-4 h-4 me-2" />
                    {generateQrCodeMutation.isPending ? "Generating..." : "Generate QR Code"}
                  </Button>
                  <div>
                    <input
                      type="file"
                      ref={qrFileInputRef}
                      className="hidden"
                      accept=".svg,.png"
                      onChange={handleQrFileUpload}
                      data-testid="input-qr-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => qrFileInputRef.current?.click()}
                      disabled={uploadQrCodeMutation.isPending}
                      data-testid="button-upload-qr-code"
                    >
                      <Upload className="w-4 h-4 me-2" />
                      {uploadQrCodeMutation.isPending ? "Uploading..." : "Upload Custom QR (SVG/PNG)"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print History */}
        <Card data-testid="card-invoice-print-history">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setPrintHistoryOpen(o => !o)}
            data-testid="card-header-invoice-print-history"
          >
            <CardTitle className="text-lg flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                Print History
                {printRecords.length > 0 && (
                  <span className="ms-1 text-xs font-normal text-muted-foreground">({printRecords.length})</span>
                )}
              </span>
              {printHistoryOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground/70" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/70" />}
            </CardTitle>
          </CardHeader>
          {printHistoryOpen && (
            <CardContent>
              {printRecords.length === 0 ? (
                <div className="text-center py-8">
                  <Printer className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No prints yet. Use the Print button to create a print record.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {printRecords.map((record: any) => {
                    const isStale = invoice.updatedAt && record.printedAt && new Date(invoice.updatedAt) > new Date(record.printedAt);
                    return (
                      <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span>{record.displayCurrency}</span>
                            {record.displayCurrency !== "EGP" && (
                              <span className="text-muted-foreground">@ {parseFloat(record.exchangeRate).toFixed(2)} EGP</span>
                            )}
                            <span className="text-foreground">→ {parseFloat(record.convertedTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span title={format(new Date(record.printedAt), 'MMM dd, yyyy HH:mm')}>
                                {formatDistanceToNow(new Date(record.printedAt), { addSuffix: true })}
                              </span>
                            </span>
                            {(record.printedByName || record.printedByEmail) && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {record.printedByName || record.printedByEmail}
                              </span>
                            )}
                          </div>
                          {isStale && (
                            <div className="flex items-center gap-1 text-xs text-warning">
                              <AlertTriangle className="w-3 h-3" />
                              This document may have changed since this print.
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/invoices/print/${record.id}`, "_blank")}
                          data-testid={`button-reprint-${record.id}`}
                        >
                          <ExternalLink className="w-3 h-3 me-1" />
                          Reprint
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Invoice History */}
        <Card data-testid="card-invoice-history">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5" />
              History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoiceHistoryData.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No history events yet. Changes to this invoice will appear here.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute start-4 top-0 bottom-0 w-px bg-muted" />
                <div className="space-y-4">
                  {invoiceHistoryData.map((entry) => (
                    <div key={entry.id} className="flex gap-4 ps-10 relative">
                      <div className="absolute start-2.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white ring-2 ring-primary/20" />
                      <div className="flex-1 bg-muted/50 rounded-lg p-3 border border-border">
                        <p className="text-sm font-medium text-foreground">{entry.event}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          {entry.actor && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {entry.actor}
                            </span>
                          )}
                          {entry.createdAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span title={format(new Date(entry.createdAt), 'MMM dd, yyyy HH:mm')}>
                                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      
      {/* Print Dialog */}
      <Dialog open={!!assigningPayment} onOpenChange={(o) => { if (!o) setAssigningPayment(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("paysrc.assign_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <PaymentSourceSelect id="assign-source" value={assignSourceId} onChange={setAssignSourceId} suggestFor={assigningPayment?.paymentMethod} fallbackToDefault />
            <p className="text-xs text-muted-foreground">{t("paysrc.assign_hint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningPayment(null)}>{t("common.cancel")}</Button>
            <Button
              disabled={!assignSourceId || assignSourceMutation.isPending}
              onClick={() => assignSourceMutation.mutate({ paymentId: assigningPayment.id, paymentSourceId: assignSourceId })}
              data-testid="confirm-assign-source"
            >
              {t("paysrc.assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Display Currency</Label>
              <Select value={printCurrency} onValueChange={(v) => { setPrintCurrency(v); if (v === "EGP") setPrintRate("1"); }}>
                <SelectTrigger data-testid="select-print-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EGP">EGP — Egyptian Pound (ج.م)</SelectItem>
                  <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                  <SelectItem value="SAR">SAR — Saudi Riyal (ر.س)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Exchange Rate (1 {printCurrency} = ? EGP)</Label>
              <Input
                type="number"
                value={printRate}
                onChange={(e) => setPrintRate(e.target.value)}
                disabled={printCurrency === "EGP"}
                min="0.0001"
                step="0.01"
                placeholder="e.g. 50.00"
                data-testid="input-print-rate"
              />
              {printCurrency === "EGP" && (
                <p className="text-xs text-muted-foreground mt-1">Rate is locked to 1 for EGP.</p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-sm text-muted-foreground mb-1">Live converted total preview</p>
              {(() => {
                const rate = printCurrency === "EGP" ? 1 : (parseFloat(printRate) || 0);
                const converted = rate > 0 ? Math.round((totalAmount / rate) * 100) / 100 : 0;
                const symbol = printCurrency === "USD" ? "$" : printCurrency === "SAR" ? "ر.س" : "ج.م";
                const formatted = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <>
                    <p className="text-xl font-bold text-foreground">
                      {printCurrency === "USD" ? `${symbol}${formatted}` : `${formatted} ${symbol}`}
                    </p>
                    {printCurrency !== "EGP" && (
                      <p className="text-xs text-muted-foreground/70 mt-1">Source total: {formatCurrency(totalAmount)}</p>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handlePrint}
                disabled={isPrinting || (printCurrency !== "EGP" && (parseFloat(printRate) <= 0 || isNaN(parseFloat(printRate))))}
                className="flex-1"
                data-testid="button-confirm-print"
              >
                <Printer className="w-4 h-4 me-2" />
                {isPrinting ? "Preparing..." : "Print"}
              </Button>
              <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreditInfo} onOpenChange={setShowCreditInfo}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>Client Credit Balance</span>
            </DialogTitle>
          </DialogHeader>
          
          {clientCredit ? (
            <div className="space-y-4">
              <div className="p-4 bg-success-soft rounded-lg border border-success/20">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-success">Current Credit Balance</Label>
                    <p className="text-2xl font-bold text-success">
                      {formatCurrency((clientCredit as any)?.currentBalance || "0")}
                    </p>
                  </div>
                  {parseFloat((clientCredit as any)?.currentBalance || "0") > 0 && remainingAmount > 0 ? (
                    <Button
                      onClick={() => {
                        const creditToApply = Math.min(parseFloat((clientCredit as any).currentBalance || "0"), remainingAmount);
                        applyCreditMutation.mutate(creditToApply);
                      }}
                      disabled={applyCreditMutation.isPending}
                      className="bg-success hover:bg-success"
                    >
                      {applyCreditMutation.isPending ? "Applying..." : "Apply to Invoice"}
                    </Button>
                  ) : null}
                </div>
              </div>
              
              {(clientCredit as any)?.history && (clientCredit as any)?.history.length > 0 ? (
                <div>
                  <Label className="text-lg font-semibold">Credit History</Label>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                    {(clientCredit as any).history.map((entry: any) => (
                      <div key={entry.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant={entry.type === 'credit_added' ? 'default' : 'outline'}>
                              {entry.type.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="font-medium">
                              {formatCurrency(entry.amount)}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(entry.createdAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Previous: {formatCurrency(entry.previousBalance)}</span>
                          <span>New: {formatCurrency(entry.newBalance)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}