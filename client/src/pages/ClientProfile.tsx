import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Phone, Mail, MapPin, Calendar, DollarSign, FileText, MessageSquare, RefreshCcw, Wallet, FolderKanban, ExternalLink, TrendingDown, TrendingUp, Minus, KeyRound, Plus, Eye, EyeOff, Copy, Trash2, Globe, Server, AtSign, Share2 } from "lucide-react";
import { DetailPageHeader } from "@/components/dashboard/DetailPageHeader";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { Client, Quotation, Invoice, ClientNote } from "@shared/schema";

type CredentialType = "social" | "website" | "server" | "email" | "other";

interface Credential {
  id: string;
  clientId: string;
  label: string;
  type: CredentialType;
  username: string | null;
  url: string | null;
  notes: string | null;
  hasPassword: boolean;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  social: "Social Media",
  website: "Website",
  server: "Server / SSH",
  email: "Email",
  other: "Other",
};

const CREDENTIAL_TYPE_COLORS: Record<CredentialType, string> = {
  social: "bg-pink-100 text-pink-800",
  website: "bg-blue-100 text-blue-800",
  server: "bg-gray-100 text-gray-800",
  email: "bg-yellow-100 text-yellow-800",
  other: "bg-purple-100 text-purple-800",
};

function CredentialTypeIcon({ type }: { type: CredentialType }) {
  switch (type) {
    case "social": return <Share2 className="w-4 h-4" />;
    case "website": return <Globe className="w-4 h-4" />;
    case "server": return <Server className="w-4 h-4" />;
    case "email": return <AtSign className="w-4 h-4" />;
    default: return <KeyRound className="w-4 h-4" />;
  }
}

const credentialFormSchema = z.object({
  label: z.string().min(1, "Label is required"),
  type: z.enum(["social", "website", "server", "email", "other"]),
  username: z.string().optional(),
  password: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

type CredentialFormValues = z.infer<typeof credentialFormSchema>;

function CredentialDialogForm({
  defaultValues,
  isEditing,
  isPending,
  onSubmit,
  onCancel,
}: {
  defaultValues: CredentialFormValues;
  isEditing: boolean;
  isPending: boolean;
  onSubmit: (values: CredentialFormValues) => void;
  onCancel: () => void;
}) {
  const form = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Instagram Admin" {...field} data-testid="input-credential-label" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-credential-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(CREDENTIAL_TYPE_LABELS) as CredentialType[]).map((t) => (
                    <SelectItem key={t} value={t}>{CREDENTIAL_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username / Login</FormLabel>
              <FormControl>
                <Input placeholder="username or email" {...field} data-testid="input-credential-username" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Password{isEditing && <span className="text-xs text-gray-400 ml-1">(leave blank to keep existing)</span>}
              </FormLabel>
              <FormControl>
                <Input type="password" placeholder="password" {...field} data-testid="input-credential-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL / Host</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com or 192.168.1.1" {...field} data-testid="input-credential-url" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional notes..." rows={2} {...field} data-testid="input-credential-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={isPending} data-testid="button-save-credential">
            {isPending ? "Saving..." : "Save Credential"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Form>
  );
}

function CredentialsVault({ clientId, canManage }: { clientId: string; canManage: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [loadingPassword, setLoadingPassword] = useState<Record<string, boolean>>({});

  const { data: credentials = [], isLoading } = useQuery<Credential[]>({
    queryKey: ["/api/clients", clientId, "credentials"],
  });

  const createMutation = useMutation({
    mutationFn: async (values: CredentialFormValues) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/credentials`, values);
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create credential");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "credentials"] });
      setShowAddDialog(false);
      toast({ title: "Credential added", description: "The credential has been saved securely." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CredentialFormValues }) => {
      const res = await apiRequest("PATCH", `/api/clients/${clientId}/credentials/${id}`, values);
      if (!res.ok) throw new Error((await res.json()).message || "Failed to update credential");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "credentials"] });
      setEditingCred(null);
      toast({ title: "Credential updated", description: "Changes have been saved." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (credId: string) => {
      const res = await apiRequest("DELETE", `/api/clients/${clientId}/credentials/${credId}`, {});
      if (!res.ok) throw new Error("Failed to delete credential");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "credentials"] });
      toast({ title: "Credential deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function revealPassword(credId: string) {
    if (revealedPasswords[credId] !== undefined) {
      setRevealedPasswords((p) => { const n = { ...p }; delete n[credId]; return n; });
      return;
    }
    setLoadingPassword((p) => ({ ...p, [credId]: true }));
    try {
      const res = await apiRequest("GET", `/api/clients/${clientId}/credentials/${credId}/password`, undefined);
      const data = await res.json();
      setRevealedPasswords((p) => ({ ...p, [credId]: data.password }));
    } catch {
      toast({ title: "Failed to reveal password", variant: "destructive" });
    } finally {
      setLoadingPassword((p) => ({ ...p, [credId]: false }));
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied`, description: "Copied to clipboard." });
    });
  }

  function openEdit(cred: Credential) {
    setEditingCred(cred);
  }

  const addDefaults: CredentialFormValues = { label: "", type: "other", username: "", password: "", url: "", notes: "" };
  const editDefaults: CredentialFormValues = editingCred
    ? { label: editingCred.label, type: editingCred.type, username: editingCred.username ?? "", password: "", url: editingCred.url ?? "", notes: editingCred.notes ?? "" }
    : addDefaults;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Credential Vault</h3>
          <p className="text-sm text-gray-500">Stored access credentials for this client. Passwords are encrypted at rest.</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-credential">
            <Plus className="w-4 h-4 mr-2" />
            Add Credential
          </Button>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" />Add Credential</DialogTitle>
          </DialogHeader>
          <CredentialDialogForm
            defaultValues={addDefaults}
            isEditing={false}
            isPending={createMutation.isPending}
            onSubmit={(values) => createMutation.mutate(values)}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCred} onOpenChange={(o) => { if (!o) setEditingCred(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" />Edit Credential</DialogTitle>
          </DialogHeader>
          {editingCred && (
            <CredentialDialogForm
              key={editingCred.id}
              defaultValues={editDefaults}
              isEditing={true}
              isPending={updateMutation.isPending}
              onSubmit={(values) => updateMutation.mutate({ id: editingCred.id, values })}
              onCancel={() => setEditingCred(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No credentials stored</p>
          {canManage && <p className="text-sm mt-1">Add client logins, API keys, and access details.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => {
            const revealed = revealedPasswords[cred.id];
            const loading = loadingPassword[cred.id];
            return (
              <Card key={cred.id} data-testid={`card-credential-${cred.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-gray-50 rounded-lg shrink-0 mt-0.5">
                        <CredentialTypeIcon type={cred.type} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{cred.label}</span>
                          <Badge className={`text-xs ${CREDENTIAL_TYPE_COLORS[cred.type]}`}>
                            {CREDENTIAL_TYPE_LABELS[cred.type]}
                          </Badge>
                        </div>

                        {cred.username && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 shrink-0">Username</span>
                            <span className="text-sm font-mono">{cred.username}</span>
                            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => copyToClipboard(cred.username!, "Username")} data-testid={`button-copy-username-${cred.id}`}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        )}

                        {cred.hasPassword && canManage && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 shrink-0">Password</span>
                            <span className="text-sm font-mono">{revealed !== undefined ? revealed : "••••••••"}</span>
                            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => revealPassword(cred.id)} disabled={loading} data-testid={`button-reveal-password-${cred.id}`}>
                              {loading ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" /> : revealed !== undefined ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                            {revealed !== undefined && (
                              <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => copyToClipboard(revealed, "Password")} data-testid={`button-copy-password-${cred.id}`}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        )}

                        {cred.url && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 shrink-0">URL / Host</span>
                            <a href={cred.url.startsWith("http") ? cred.url : `https://${cred.url}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate max-w-xs flex items-center gap-1" data-testid={`link-credential-url-${cred.id}`}>
                              {cred.url}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        )}

                        {cred.notes && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 w-20 shrink-0 mt-0.5">Notes</span>
                            <span className="text-sm text-gray-600">{cred.notes}</span>
                          </div>
                        )}

                        <p className="text-xs text-gray-400">
                          Last updated {cred.updatedAt ? formatDistanceToNow(new Date(cred.updatedAt), { addSuffix: true }) : "unknown"}
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(cred)} data-testid={`button-edit-credential-${cred.id}`}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" data-testid={`button-delete-credential-${cred.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Credential</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to permanently delete "{cred.label}"? This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(cred.id)} className="bg-red-600 hover:bg-red-700" data-testid={`button-confirm-delete-credential-${cred.id}`}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAdmin, roleName } = usePermissions();
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

  const { data: creditData } = useQuery<{ currentBalance: number; history: any[] }>({
    queryKey: ["/api/clients", id, "credit"],
    enabled: !!id,
  });

  const { data: allProjects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    enabled: !!id,
  });

  const clientProjects = (allProjects as any[]).filter((p: any) => p.clientId === id);

  const updateClientMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed with status ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsEditingClient(false);
      toast({
        title: t("crm.updated"),
        description: t("crm.updated_desc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("crm.update_failed"),
        description: error.message || t("crm.update_failed_desc"),
        variant: "destructive",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/clients/${id}/notes`, {
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
      const response = await apiRequest("POST", `/api/clients/${id}/recalculate-value`, {});
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
      case 'pending': return 'bg-yellow-100 text-yellow-800';
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

  const getCreditTypeIcon = (type: string) => {
    switch (type) {
      case 'credit_added':
      case 'credit_refunded': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'credit_used':
      case 'credit_applied': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCreditTypeColor = (type: string) => {
    switch (type) {
      case 'credit_added':
      case 'credit_refunded': return 'text-green-700';
      case 'credit_used':
      case 'credit_applied': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const creditBalance = creditData?.currentBalance ?? parseFloat(client.creditBalance || '0');
  const creditHistory = creditData?.history ?? [];

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      <DetailPageHeader
        backHref="/clients"
        backLabel="Back to Clients"
        title={client.name}
        subtitle="Client Profile"
        badge={
          <Badge className={getStatusColor(client.status)}>
            {client.status}
          </Badge>
        }
        actions={
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
                    <SelectItem value="pending">Pending</SelectItem>
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
        }
      />

      {/* Client Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
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
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-lg font-bold">EGP {parseFloat(client.totalValue || '0').toLocaleString()}</p>
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
          <CardContent className="p-5">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-lg ${creditBalance > 0 ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <Wallet className={`w-5 h-5 ${creditBalance > 0 ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Credit Balance</p>
                <p className={`text-lg font-bold ${creditBalance > 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
                  EGP {creditBalance.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Quotations</p>
                <p className="text-xl font-bold">{quotations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-600" />
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
        <TabsList className="flex w-full overflow-x-auto justify-start gap-0 h-auto flex-nowrap pb-px">
          <TabsTrigger value="details" className="shrink-0 whitespace-nowrap">Details</TabsTrigger>
          <TabsTrigger value="quotations" className="shrink-0 whitespace-nowrap">Quotations</TabsTrigger>
          <TabsTrigger value="invoices" className="shrink-0 whitespace-nowrap">Invoices</TabsTrigger>
          <TabsTrigger value="credit" className="shrink-0 whitespace-nowrap">Credit History</TabsTrigger>
          <TabsTrigger value="projects" className="shrink-0 whitespace-nowrap">Projects</TabsTrigger>
          <TabsTrigger value="credentials" data-testid="tab-credentials" className="shrink-0 whitespace-nowrap flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5" />
            Vault
          </TabsTrigger>
          <TabsTrigger value="notes" className="shrink-0 whitespace-nowrap">Notes</TabsTrigger>
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
                <div className="overflow-x-auto">
                <Table className="min-w-[520px]">
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
                        <TableCell>EGP {parseFloat(quotation.amount || '0').toLocaleString()}</TableCell>
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
                </div>
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
                <div className="overflow-x-auto">
                <Table className="min-w-[480px]">
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
                        <TableCell>EGP {parseFloat(invoice.amount || '0').toLocaleString()}</TableCell>
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Credit History</CardTitle>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Current Balance</p>
                  <p className={`text-xl font-bold ${creditBalance > 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
                    EGP {creditBalance.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {creditHistory.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No credit transactions found for this client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Related Invoice</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditHistory.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getCreditTypeIcon(entry.type)}
                            <span className="capitalize text-sm">{entry.type.replace(/_/g, ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{entry.description}</TableCell>
                        <TableCell className={`font-medium ${getCreditTypeColor(entry.type)}`}>
                          {entry.type === 'credit_used' || entry.type === 'credit_applied' ? '-' : '+'}
                          EGP {parseFloat(entry.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          EGP {parseFloat(entry.newBalance).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.relatedInvoiceId ? (
                            <Link href={`/invoices/${entry.relatedInvoiceId}`} className="text-blue-600 hover:underline flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              #{entry.relatedInvoiceId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {entry.createdAt ? format(new Date(entry.createdAt), 'MMM dd, yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {clientProjects.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No projects linked to this client.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientProjects.map((project: any) => (
                    <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: project.color || '#3b82f6' }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{project.name}</p>
                          {project.description && (
                            <p className="text-sm text-gray-500 truncate">{project.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {project.taskCounts && (
                              <span>{project.taskCounts.total} tasks</span>
                            )}
                            {project.dueDate && (
                              <span>Due {formatDistanceToNow(new Date(project.dueDate), { addSuffix: true })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge className={getProjectStatusColor(project.status)}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            Kanban
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials">
          <Card>
            <CardContent className="p-6">
              <CredentialsVault clientId={id!} canManage={isAdmin || roleName === "Manager"} />
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
