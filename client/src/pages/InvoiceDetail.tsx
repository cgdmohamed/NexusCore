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
  AlertCircle
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
}

export default function InvoiceDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
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
    notes: ''
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      setIsAddingPayment(false);
      setPaymentForm({
        amount: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        bankTransferNumber: '',
        notes: ''
      });
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
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
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleAddItem = () => {
    if (!itemForm.name.trim()) return;
    addItemMutation.mutate(itemForm);
  };

  const handleAddPayment = () => {
    if (paymentForm.amount <= 0) return;
    addPaymentMutation.mutate(paymentForm);
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <Label className="text-sm text-gray-600">Subtotal</Label>
                <p className="text-2xl font-bold">${subtotal.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Tax Amount</Label>
                <p className="text-2xl font-bold">${taxAmount.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Total Amount</Label>
                <p className="text-2xl font-bold">${totalAmount.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Outstanding</Label>
                <p className={`text-2xl font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${remainingAmount.toLocaleString()}
                </p>
              </div>
            </div>
            
            {/* Payment Progress */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm text-gray-600">Payment Progress</Label>
                <span className="text-sm font-medium">{paymentProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Paid: ${paidAmount.toLocaleString()}</span>
                <span>Remaining: ${remainingAmount.toLocaleString()}</span>
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
                        <TableCell className="capitalize">{payment.paymentMethod.replace('_', ' ')}</TableCell>
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
    </div>
  );
}