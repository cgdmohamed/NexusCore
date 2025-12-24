import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/dashboard/Header";
import { PaymentSourceForm } from "@/components/forms/PaymentSourceForm";
import type { PaymentSource } from "@shared/schema";

export default function PaymentSourceEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: paymentSource, isLoading } = useQuery<PaymentSource>({
    queryKey: ["/api/payment-sources", id],
    enabled: !!id,
  });

  const handleClose = () => {
    setLocation(`/payment-sources/${id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Header 
          title="Loading..."
          subtitle="Please wait while we load the payment source details"
        />
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-24 bg-gray-200 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentSource) {
    return (
      <div className="space-y-6 p-6">
        <Header 
          title="Payment Source Not Found"
          subtitle="The requested payment source could not be found"
        />
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Source Not Found</h3>
            <p className="text-gray-500 mb-4">
              The payment source you're trying to edit doesn't exist or has been deleted.
            </p>
            <Button onClick={() => setLocation("/payment-sources")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Payment Sources
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Header 
        title="Edit Payment Source"
        subtitle={`Editing: ${paymentSource.name}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Payment Source Details</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentSourceForm paymentSource={paymentSource} onClose={handleClose} />
        </CardContent>
      </Card>
    </div>
  );
}
