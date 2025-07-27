import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/lib/i18n";
import { useParams, Link } from "wouter";
import { useState } from "react";
import { 
  ArrowLeft,
  Edit,
  Download,
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
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Invoice, InvoiceItem, Payment, Client } from "@shared/schema";

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
}

export default function InvoiceDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [itemForm, setItemForm] = useState<InvoiceItemFormData>({
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
    adminApproved: false
  });
  const [overpaymentWarning, setOverpaymentWarning] = useState<any>(null);
  const [showCreditInfo, setShowCreditInfo] = useState(false);
  const [refundForm, setRefundForm] = useState({
    refundAmount: "",
    refundMethod: "",
    refundReference: "",
    notes: ""
  });

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
      setIsAddingPayment(false);
      setOverpaymentWarning(null);
      setPaymentForm({
        amount: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        bankTransferNumber: '',
        notes: '',
        adminApproved: false
      });
      
      let message = "Payment recorded successfully";
      if ((data as any)?.overpaymentHandled && (data as any)?.creditAdded > 0) {
        message += `. $${(data as any).creditAdded} added to client credit balance.`;
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

  const refundMutation = useMutation({
    mutationFn: async (refundData: any) => {
      return apiRequest("POST", `/api/invoices/${id}/refund`, refundData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${invoice?.clientId}/credit`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      setIsProcessingRefund(false);
      setRefundForm({
        refundAmount: "",
        refundMethod: "",
        refundReference: "",
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
      notes: refundForm.notes
    });
  };

  if (invoiceLoading) {
    return (
      <div className="space-y-6">
        <Header title="Loading..." subtitle="Please wait" />
        <div className="p-6 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <Header title="Invoice Not Found" subtitle="The requested invoice could not be found" />
        <div className="p-6 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Invoice not found</p>
          <Link href="/invoices">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
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
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'partially_paid': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sent': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'refunded': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'partially_refunded': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'partially_paid': return <CreditCard className="w-4 h-4" />;
      case 'sent': return <FileText className="w-4 h-4" />;
      case 'draft': return <Edit className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
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

  const isOverdue = invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return (
    <div className="space-y-6">
      <Header 
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`${client?.name || 'Unknown Client'} • ${invoice.status}`}
      />
      
      {/* Action Buttons */}
      <div className="px-6 pb-4">
        <div className="flex space-x-2">
          <Link href="/invoices">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
          </Link>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button>
            <Send className="w-4 h-4 mr-2" />
            Send Invoice
          </Button>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Invoice Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-gray-600">Invoice Number</Label>
                <p className="font-semibold">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Status</Label>
                <Badge variant="outline" className={getStatusColor(invoice.status)}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(invoice.status)}
                    <span className="capitalize">{invoice.status.replace('_', ' ')}</span>
                  </div>
                </Badge>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Title</Label>
                <p>{invoice.title || 'No title'}</p>
              </div>
              {invoice.description && (
                <div>
                  <Label className="text-sm text-gray-600">Description</Label>
                  <p>{invoice.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <User className="w-5 h-5 mr-2" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-gray-600">Client Name</Label>
                <p className="font-semibold">{client?.name || 'Unknown Client'}</p>
              </div>
              {client?.email && (
                <div>
                  <Label className="text-sm text-gray-600">Email</Label>
                  <p>{client.email}</p>
                </div>
              )}
              {client?.phone && (
                <div>
                  <Label className="text-sm text-gray-600">Phone</Label>
                  <p>{client.phone}</p>
                </div>
              )}
              {client?.address && (
                <div>
                  <Label className="text-sm text-gray-600">Address</Label>
                  <p>{client.address}</p>
                </div>
              )}
              {clientCredit && parseFloat((clientCredit as any)?.currentBalance || "0") > 0 ? (
                <div>
                  <Label className="text-sm text-gray-600">Available Credit</Label>
                  <p className="font-semibold text-green-600">
                    ${parseFloat((clientCredit as any).currentBalance).toLocaleString()}
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
                <Calendar className="w-5 h-5 mr-2" />
                Dates & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-gray-600">Invoice Date</Label>
                <p>{invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'MMM dd, yyyy') : 'Not set'}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Due Date</Label>
                <p className={isOverdue ? 'text-red-600 font-medium' : ''}>
                  {invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'Not set'}
                  {isOverdue && ' (Overdue)'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Created</Label>
                <p>{invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'Unknown'}</p>
              </div>
              {invoice.paidDate && (
                <div>
                  <Label className="text-sm text-gray-600">Paid Date</Label>
                  <p>{format(new Date(invoice.paidDate), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-blue-900">
              <DollarSign className="w-5 h-5 mr-2" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Prominent Invoice Total */}
            <div className="bg-white p-6 rounded-lg border-2 border-blue-300 shadow-sm mb-6">
              <div className="text-center">
                <Label className="text-sm text-blue-700 font-medium">INVOICE TOTAL</Label>
                <p className="text-5xl font-bold text-blue-900 mt-2">${totalAmount.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <Label className="text-sm text-gray-600">Subtotal</Label>
                <p className="text-xl font-bold">${subtotal.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <Label className="text-sm text-gray-600">Tax Amount</Label>
                <p className="text-xl font-bold">${taxAmount.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <Label className="text-sm text-green-700 font-medium">Paid Amount</Label>
                <p className="text-xl font-bold text-green-700">${paidAmount.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <Label className="text-sm text-red-700 font-medium">Outstanding</Label>
                <p className="text-xl font-bold text-red-700">${remainingAmount.toLocaleString()}</p>
              </div>
            </div>
            
            {/* Payment Progress */}
            <div className="mt-6 bg-white p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm text-gray-600 font-medium">Payment Progress</Label>
                <span className="text-lg font-bold text-blue-600">{paymentProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-2">
                <span className="font-medium">Paid: ${paidAmount.toLocaleString()}</span>
                <span className="font-medium">Remaining: ${remainingAmount.toLocaleString()}</span>
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
                    <Plus className="w-4 h-4 mr-2" />
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
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No items added to this invoice</p>
                <Button onClick={() => setIsAddingItem(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.description || '-'}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${parseFloat(item.totalPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                            disabled={deleteItemMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
                        <RotateCcw className="w-4 h-4 mr-2" />
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
                            className="w-full p-2 border border-gray-300 rounded-md"
                          >
                            <option value="">Select refund method</option>
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="credit_card">Credit Card Reversal</option>
                            <option value="check">Check</option>
                          </select>
                        </div>
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
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
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
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
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
                      <div className="p-4 border border-red-200 bg-red-50 rounded-md">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-red-800">Overpayment Detected</h4>
                            <p className="text-sm text-red-700 mt-1">
                              {overpaymentWarning.message}
                            </p>
                            {overpaymentWarning.details && (
                              <div className="text-xs text-red-600 mt-2 space-y-1">
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
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No payments recorded for this invoice</p>
                <Button onClick={() => setIsAddingPayment(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Record First Payment
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.paymentDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="font-medium">${parseFloat(payment.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                            {payment.isOverpayment && (
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                Overpayment
                              </Badge>
                            )}
                            {payment.paymentMethod === 'credit_balance' && (
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                                Credit
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{payment.bankTransferNumber || '-'}</TableCell>
                        <TableCell>{payment.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Credit Balance Dialog */}
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
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-green-700">Current Credit Balance</Label>
                    <p className="text-2xl font-bold text-green-800">
                      ${parseFloat((clientCredit as any)?.currentBalance || "0").toLocaleString()}
                    </p>
                  </div>
                  {parseFloat((clientCredit as any)?.currentBalance || "0") > 0 && remainingAmount > 0 ? (
                    <Button
                      onClick={() => {
                        const creditToApply = Math.min(parseFloat((clientCredit as any).currentBalance || "0"), remainingAmount);
                        applyCreditMutation.mutate(creditToApply);
                      }}
                      disabled={applyCreditMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
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
                              ${parseFloat(entry.amount).toFixed(2)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {format(new Date(entry.createdAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Previous: ${parseFloat(entry.previousBalance).toFixed(2)}</span>
                          <span>New: ${parseFloat(entry.newBalance).toFixed(2)}</span>
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