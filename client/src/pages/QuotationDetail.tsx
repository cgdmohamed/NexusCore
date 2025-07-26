import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, FileText, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Quotation, QuotationItem, Service, Client } from "@shared/schema";

export default function QuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [discount, setDiscount] = useState("0");

  const { data: quotation, isLoading: quotationLoading } = useQuery<Quotation>({
    queryKey: ["/api/quotations", id],
  });

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", quotation?.clientId],
    enabled: !!quotation?.clientId,
  });

  const { data: quotationItems = [] } = useQuery<QuotationItem[]>({
    queryKey: ["/api/quotations", id, "items"],
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Initialize services on component mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await apiRequest("/api/services/initialize", "POST", {});
        queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      } catch (error) {
        console.error("Failed to initialize services:", error);
      }
    };
    initializeServices();
  }, [queryClient]);

  const addItemMutation = useMutation({
    mutationFn: async (itemData: any) => {
      return apiRequest(`/api/quotations/${id}/items`, "POST", itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", id] });
      setIsAddingItem(false);
      resetForm();
      toast({
        title: "Item added",
        description: "Quotation item has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to add item",
        description: "Could not add the quotation item.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedService("");
    setCustomDescription("");
    setQuantity("1");
    setUnitPrice("0");
    setDiscount("0");
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedService(serviceId);
    if (serviceId) {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        setCustomDescription(service.description || "");
        setUnitPrice(service.defaultPrice);
      }
    } else {
      setCustomDescription("");
      setUnitPrice("0");
    }
  };

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const disc = parseFloat(discount) || 0;
    const subtotal = qty * price;
    return subtotal - (subtotal * disc / 100);
  };

  const handleAddItem = () => {
    if (!customDescription.trim()) {
      toast({
        title: "Description required",
        description: "Please provide a description for the item.",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      serviceId: selectedService || null,
      description: customDescription,
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: calculateTotal().toFixed(2),
      discount: discount,
    };

    addItemMutation.mutate(itemData);
  };

  const quotationTotal = quotationItems.reduce((sum, item) => {
    return sum + parseFloat(item.totalPrice);
  }, 0);

  if (quotationLoading) {
    return (
      <div className="p-6">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quotation Not Found</h2>
          <p className="text-gray-600 mb-4">The requested quotation could not be found.</p>
          <Link href="/quotations">
            <Button>Back to Quotations</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/quotations">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Quotations
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{quotation.quotationNumber}</h1>
            <p className="text-gray-600">{quotation.title}</p>
          </div>
        </div>
        <Badge className={getStatusColor(quotation.status)}>
          {quotation.status}
        </Badge>
      </div>

      {/* Quotation Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Client</p>
                <p className="text-xl font-bold">
                  {client ? (
                    <Link href={`/crm/${client.id}`} className="hover:underline">
                      {client.name}
                    </Link>
                  ) : 'Loading...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-xl font-bold">${quotationTotal.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Items</p>
                <p className="text-xl font-bold">{quotationItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotation Details */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quotation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Description</Label>
                <p className="text-lg">{quotation.description || "No description provided"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Valid Until</Label>
                <p className="text-lg">
                  {quotation.validUntil ? 
                    formatDistanceToNow(new Date(quotation.validUntil), { addSuffix: true }) : 
                    "No expiry date"
                  }
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Created</Label>
                <p className="text-lg">
                  {quotation.createdAt ? 
                    formatDistanceToNow(new Date(quotation.createdAt), { addSuffix: true }) : 
                    "Unknown"
                  }
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Last Updated</Label>
                <p className="text-lg">
                  {quotation.updatedAt ? 
                    formatDistanceToNow(new Date(quotation.updatedAt), { addSuffix: true }) : 
                    "Unknown"
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quotation Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quotation Items</CardTitle>
            <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Quotation Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="service">Service (Optional)</Label>
                    <Select value={selectedService} onValueChange={handleServiceChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a service or enter custom" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Custom Item</SelectItem>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - ${service.defaultPrice}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="Enter item description"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="unitPrice">Unit Price ($)</Label>
                      <Input
                        id="unitPrice"
                        type="number"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="discount">Discount (%)</Label>
                    <Input
                      id="discount"
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="text-lg font-bold">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleAddItem}
                      disabled={addItemMutation.isPending || !customDescription.trim()}
                      className="flex-1"
                    >
                      {addItemMutation.isPending ? "Adding..." : "Add Item"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddingItem(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {quotationItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No items added to this quotation yet.</p>
              <Button onClick={() => setIsAddingItem(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Item
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotationItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.serviceId && (
                            <p className="text-sm text-gray-500">Service Item</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">${parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{parseFloat(item.discount).toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-medium">
                        ${parseFloat(item.totalPrice).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={4} className="text-right font-bold">
                      Grand Total:
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      ${quotationTotal.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}