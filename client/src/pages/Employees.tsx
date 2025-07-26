import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeForm } from "@/components/forms/EmployeeForm";

export default function Employees() {
  const { t } = useTranslation();
  
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

  const employeeList = employees as any[];

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.employees')}
        subtitle="Manage employee records and performance"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">All Employees</h3>
              <EmployeeForm />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-neutral">{t('common.loading')}</p>
              </div>
            ) : employeeList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral mb-4">No employees found</p>
                <EmployeeForm 
                  trigger={
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add your first employee
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeList.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell className="capitalize">{employee.department}</TableCell>
                      <TableCell>${parseFloat(employee.salary || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-100 text-secondary border-green-200">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">Edit</Button>
                          <Button variant="outline" size="sm">View</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
