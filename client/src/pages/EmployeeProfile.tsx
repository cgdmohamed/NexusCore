import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Calendar, Building, User, TrendingUp } from "lucide-react";
import { EmployeeKpiTab } from "@/components/EmployeeKpiTab";
import { format } from "date-fns";
import { Link } from "wouter";
import type { Employee } from "@shared/schema";

export default function EmployeeProfile() {
  const [match, params] = useRoute("/employees/:id");
  const employeeId = params?.id;

  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: [`/api/employees/${employeeId}`],
    enabled: !!employeeId,
  });

  if (!match || !employeeId) return <div>Employee not found</div>;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header title="Employee Profile" subtitle="Loading employee information..." />
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <Header title="Employee Profile" subtitle="Employee not found" />
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Employee Not Found</h3>
            <p className="text-gray-600 mb-4">The requested employee could not be found.</p>
            <Link href="/team-roles">
              <Button><ArrowLeft className="h-4 w-4 mr-2" />Back to Team & Roles</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "inactive": return "bg-gray-100 text-gray-800";
      case "on_leave": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getDepartmentIcon = (department: string) => {
    switch (department) {
      case "operations": return "⚙️";
      case "finance": return "💰";
      case "hr": return "👥";
      case "sales": return "📈";
      case "management": return "🎯";
      default: return "🏢";
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title="Employee Profile"
        subtitle={`${employee.firstName} ${employee.lastName} — ${employee.jobTitle}`}
      />

      <div className="p-3 md:p-6 space-y-5">
        {/* Back Button */}
        <Link href="/team-roles">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Team & Roles
          </Button>
        </Link>

        {/* Employee Header Card */}
        <Card>
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Avatar */}
              <div className="shrink-0">
                <img
                  src={employee.profileImage || `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150`}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-100 shadow"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Name + Status */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold text-text">
                    {employee.firstName} {employee.lastName}
                  </h1>
                  <Badge className={getStatusColor(employee.status)}>
                    {employee.status.replace("_", " ")}
                  </Badge>
                </div>

                {/* Job Title */}
                <p className="text-base text-gray-500 mb-4">{employee.jobTitle}</p>

                {/* Contact Info — horizontal chips */}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span>{employee.email}</span>
                  </div>

                  {employee.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span>{employee.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Building className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span>{getDepartmentIcon(employee.department)} {employee.department}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span>Hired {employee.hiringDate ? format(new Date(employee.hiringDate), 'MMM d, yyyy') : 'N/A'}</span>
                  </div>
                </div>

                {employee.notes && (
                  <div className="mt-4 px-3 py-2 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-sm text-gray-600">{employee.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="performance" className="space-y-5">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="performance" className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span>Performance & KPIs</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>Profile Details</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Employment History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <EmployeeKpiTab
              employeeId={employee.id}
              employeeName={`${employee.firstName} ${employee.lastName}`}
            />
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Employee Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Personal Information</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Full Name", value: `${employee.firstName} ${employee.lastName}` },
                        { label: "Email", value: employee.email },
                        ...(employee.phone ? [{ label: "Phone", value: employee.phone }] : []),
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                          <span className="text-sm text-gray-500">{label}</span>
                          <span className="text-sm font-medium text-text">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Employment Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Job Title</span>
                        <span className="text-sm font-medium text-text">{employee.jobTitle}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Department</span>
                        <span className="text-sm font-medium text-text capitalize">{employee.department}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Status</span>
                        <Badge className={getStatusColor(employee.status)}>{employee.status}</Badge>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-500">Hiring Date</span>
                        <span className="text-sm font-medium text-text">
                          {employee.hiringDate ? format(new Date(employee.hiringDate), 'MMMM d, yyyy') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {employee.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Additional Notes</h3>
                    <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                      <p className="text-sm text-gray-700">{employee.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Employment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                    <div className="w-2.5 h-2.5 bg-primary rounded-full mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-medium text-text">{employee.jobTitle}</h4>
                        <Badge className="bg-green-100 text-green-800">Current</Badge>
                      </div>
                      <p className="text-sm text-gray-500 capitalize mt-0.5">{employee.department} Department</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {employee.hiringDate ? format(new Date(employee.hiringDate), 'MMMM yyyy') : 'N/A'} — Present
                      </p>
                    </div>
                  </div>

                  <div className="text-center py-6 text-gray-400">
                    <Calendar className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No previous employment history recorded</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
