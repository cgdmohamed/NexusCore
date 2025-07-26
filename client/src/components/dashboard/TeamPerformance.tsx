import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

export function TeamPerformance() {
  const { t } = useTranslation();

  // This would typically come from API data
  const teamMembers = [
    {
      id: "1",
      name: "Khalid Ahmed",
      role: "Sales Manager",
      performance: 98,
      profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=40&h=40",
    },
    {
      id: "2",
      name: "Fatima Al-Zahra",
      role: "Finance Specialist",
      performance: 94,
      profileImage: "https://images.unsplash.com/photo-1494790108755-2616b612b1a5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=40&h=40",
    },
    {
      id: "3",
      name: "Omar Hassan",
      role: "Project Coordinator",
      performance: 87,
      profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=40&h=40",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-text">{t('dashboard.teamPerformance')}</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {teamMembers.map((member) => (
          <div key={member.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src={member.profileImage} 
                alt={member.name}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div>
                <p className="text-text text-sm font-medium">{member.name}</p>
                <p className="text-neutral text-xs">{member.role}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${
                member.performance >= 95 ? 'text-secondary' : 
                member.performance >= 90 ? 'text-secondary' : 
                'text-yellow-600'
              }`}>
                {member.performance}%
              </p>
              <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                <div 
                  className={`h-2 rounded-full ${
                    member.performance >= 95 ? 'bg-secondary' : 
                    member.performance >= 90 ? 'bg-secondary' : 
                    'bg-yellow-500'
                  }`}
                  style={{ width: `${member.performance}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
