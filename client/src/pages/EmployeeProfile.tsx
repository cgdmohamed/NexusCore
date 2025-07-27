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

  if (!match || !employeeId) {
    return <div>Employee not found</div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header title="Employee Profile" subtitle="Loading employee information..." />
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Team & Roles
              </Button>
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
        subtitle={`${employee.firstName} ${employee.lastName} - ${employee.jobTitle}`}
      />
      
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Link href="/team-roles">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Team & Roles
          </Button>
        </Link>

        {/* Employee Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-6">
              <div className="relative">
                <img
                  src={employee.profileImage || `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150`}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1">
                  <Badge className={getStatusColor(employee.status)}>
                    {employee.status}
                  </Badge>
                </div>
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">
                  {employee.firstName} {employee.lastName}
                </h1>
                <p className="text-xl text-gray-600 mb-4">{employee.jobTitle}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">{employee.email}</span>
                  </div>
                  
                  {employee.phone && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">{employee.phone}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Building className="h-4 w-4" />
                    <span className="text-sm">
                      {getDepartmentIcon(employee.department)} {employee.department}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      Hired {employee.hiringDate ? format(new Date(employee.hiringDate), 'MMM d, yyyy') : 'N/A'}
                    </span>
                  </div>
                </div>
                
                {employee.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{employee.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Performance & KPIs</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Profile Details</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
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
              <CardHeader>
                <CardTitle>Employee Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-3">Personal Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Full Name:</span>
                        <span className="font-medium">{employee.firstName} {employee.lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{employee.email}</span>
                      </div>
                      {employee.phone && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium">{employee.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Employment Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Job Title:</span>
                        <span className="font-medium">{employee.jobTitle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Department:</span>
                        <span className="font-medium capitalize">{employee.department}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge className={getStatusColor(employee.status)}>
                          {employee.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hiring Date:</span>
                        <span className="font-medium">
                          {employee.hiringDate ? format(new Date(employee.hiringDate), 'MMMM d, yyyy') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {employee.notes && (
                  <div>
                    <h3 className="font-medium mb-3">Additional Notes</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">{employee.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Employment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4 p-4 border rounded-lg">
                    <div className="w-3 h-3 bg-blue-600 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{employee.jobTitle}</h4>
                        <Badge className="bg-green-100 text-green-800">Current</Badge>
                      </div>
                      <p className="text-sm text-gray-600 capitalize">{employee.department} Department</p>
                      <p className="text-sm text-gray-500">
                        {employee.hiringDate ? format(new Date(employee.hiringDate), 'MMMM yyyy') : 'N/A'} - Present
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
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