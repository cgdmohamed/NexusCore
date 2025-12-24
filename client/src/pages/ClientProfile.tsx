import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, Phone, Mail, MapPin, Calendar, DollarSign, FileText, MessageSquare, RefreshCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Quotation, Invoice, ClientNote } from "@shared/schema";

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editStatus, setEditStatus] = useState<string>("");
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("note");

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
  });

  const { data: quotations = [] } = useQuery<Quotation[]>({
    queryKey: ["/api/clients", id, "quotations"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/clients", id, "invoices"],
  });

  const { data: notes = [] } = useQuery<ClientNote[]>({
    queryKey: ["/api/clients", id, "notes"],
  });

  const updateClientMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      return apiRequest(`/api/clients/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      setIsEditingClient(false);
      toast({
        title: "Client updated",
        description: "Client information has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update client information.",
        variant: "destructive",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/clients/${id}/notes`, "POST", {
        note: newNote,
        type: noteType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      setNewNote("");
      toast({
        title: "Note added",
        description: "Client note has been added successfully.",
      });
    },
  });

  const recalculateValueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/clients/${id}/recalculate-value`, "POST", {});
      return await response.json();
    },
    onSuccess: (data: { client?: any; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      toast({
        title: "Value recalculated",
        description: data?.message || "Client value has been updated based on paid invoices.",
      });
    },
    onError: () => {
      toast({
        title: "Recalculation failed",
        description: "Failed to recalculate client value.",
        variant: "destructive",
      });
    },
  });

  if (clientLoading) {
    return (
      <div className="p-6">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Client Not Found</h2>
          <p className="text-gray-600 mb-4">The requested client could not be found.</p>
          <Link href="/clients">
            <Button>Back to Clients</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'prospect': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/clients">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Clients
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-gray-600">Client Profile</p>
          </div>
        </div>
        <Dialog open={isEditingClient} onOpenChange={(open) => {
          setIsEditingClient(open);
          if (open) setEditStatus(client.status);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Edit className="w-4 h-4 mr-2" />
              Edit Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Client Information</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const totalValueInput = formData.get("totalValue") as string;
              updateClientMutation.mutate({
                name: formData.get("name") as string,
                email: formData.get("email") as string,
                phone: formData.get("phone") as string,
                city: formData.get("city") as string,
                country: formData.get("country") as string,
                status: editStatus || client.status,
                totalValue: totalValueInput && totalValueInput.trim() !== "" ? totalValueInput : client.totalValue,
              });
            }} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={client.name} required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={client.email || ""} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={client.phone || ""} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={client.city || ""} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" defaultValue={client.country || ""} />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={editStatus || client.status} 
                  onValueChange={setEditStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="totalValue">Total Value (EGP)</Label>
                <Input 
                  id="totalValue" 
                  name="totalValue" 
                  type="number" 
                  step="0.01"
                  defaultValue={client.totalValue || "0"} 
                />
                <p className="text-xs text-gray-500 mt-1">
                  Current value based on paid invoices. You can edit this manually.
                </p>
              </div>
              <div className="flex space-x-2">
                <Button type="submit" disabled={updateClientMutation.isPending} className="flex-1">
                  {updateClientMutation.isPending ? "Updating..." : "Update Client"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsEditingClient(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge className={getStatusColor(client.status)}>
                  {client.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-xl font-bold">EGP {client.totalValue}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => recalculateValueMutation.mutate()}
                disabled={recalculateValueMutation.isPending}
                title="Recalculate value from paid invoices"
                data-testid="button-recalculate-value"
              >
                <RefreshCcw className={`w-4 h-4 ${recalculateValueMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
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
                <p className="text-sm text-gray-600">Quotations</p>
                <p className="text-xl font-bold">{quotations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoices</p>
                <p className="text-xl font-bold">{invoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="notes">Notes & Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Name</Label>
                    <p className="text-lg">{client.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Email</Label>
                    <p className="text-lg">{client.email || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Phone</Label>
                    <p className="text-lg">{client.phone || "Not provided"}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">City</Label>
                    <p className="text-lg">{client.city || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Country</Label>
                    <p className="text-lg">{client.country || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Created</Label>
                    <p className="text-lg">
                      {client.createdAt ? formatDistanceToNow(new Date(client.createdAt), { addSuffix: true }) : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotations">
          <Card>
            <CardHeader>
              <CardTitle>Quotations</CardTitle>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No quotations found for this client.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.map((quotation) => (
                      <TableRow key={quotation.id}>
                        <TableCell className="font-medium">{quotation.quotationNumber}</TableCell>
                        <TableCell>{quotation.title}</TableCell>
                        <TableCell>${quotation.amount}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(quotation.status)}>
                            {quotation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {quotation.createdAt ? formatDistanceToNow(new Date(quotation.createdAt), { addSuffix: true }) : "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Link href={`/quotations/${quotation.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No invoices found for this client.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>${invoice.amount}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.dueDate ? formatDistanceToNow(new Date(invoice.dueDate), { addSuffix: true }) : "No due date"}
                        </TableCell>
                        <TableCell>
                          {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Link href={`/invoices/${invoice.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <div className="space-y-6">
            {/* Add Note Form */}
            <Card>
              <CardHeader>
                <CardTitle>Add Note</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="noteType">Type</Label>
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="call">Phone Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="note">Note</Label>
                    <Textarea
                      id="note"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Enter your note here..."
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={() => addNoteMutation.mutate()}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                  >
                    {addNoteMutation.isPending ? "Adding..." : "Add Note"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notes List */}
            <Card>
              <CardHeader>
                <CardTitle>Notes & Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No notes or activities found for this client.</p>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note) => (
                      <div key={note.id} className="border-l-4 border-blue-200 pl-4 py-2">
                        <div className="flex items-center space-x-2 mb-2">
                          {getNoteTypeIcon(note.type)}
                          <span className="font-medium capitalize">{note.type}</span>
                          <span className="text-sm text-gray-500">
                            {note.createdAt ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }) : "Unknown"}
                          </span>
                        </div>
                        <p className="text-gray-700">{note.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}