import { 
  Users, 
  DollarSign, 
  UserCog, 
  FolderKanban, 
  Zap, 
  ShoppingCart, 
  Shield 
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'CRM',
    description: 'Manage customer relationships, track leads, and close deals faster with our intelligent CRM system.',
    color: 'from-blue-500 to-blue-600'
  },
  {
    icon: DollarSign,
    title: 'Finance & Accounting',
    description: 'Complete financial management with automated invoicing, expense tracking, and real-time reporting.',
    color: 'from-green-500 to-green-600'
  },
  {
    icon: UserCog,
    title: 'HR & Operations',
    description: 'Streamline employee management, payroll, attendance, and performance tracking in one place.',
    color: 'from-purple-500 to-purple-600'
  },
  {
    icon: FolderKanban,
    title: 'Project Management',
    description: 'Plan, execute, and monitor projects with powerful tools for task management and collaboration.',
    color: 'from-orange-500 to-orange-600'
  },
  {
    icon: Zap,
    title: 'Automation',
    description: 'Automate repetitive tasks and workflows to save time and reduce human error across your operations.',
    color: 'from-yellow-500 to-yellow-600'
  },
  {
    icon: ShoppingCart,
    title: 'Sales & Procurement',
    description: 'Optimize your supply chain with integrated sales orders, purchase orders, and inventory management.',
    color: 'from-pink-500 to-pink-600'
  },
  {
    icon: Shield,
    title: 'Admin Controls',
    description: 'Enterprise-grade security with role-based access, audit trails, and comprehensive system controls.',
    color: 'from-indigo-500 to-indigo-600'
  }
];

export function Features() {
  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything Your Business Needs
          </h2>
          <p className="text-lg text-gray-600">
            Syspro brings together all essential business functions into one powerful, integrated platform
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="group p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 bg-white"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
