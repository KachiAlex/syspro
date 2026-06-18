const stats = [
  {
    value: '10,000+',
    label: 'Active Businesses',
    icon: '🏢'
  },
  {
    value: '99.9%',
    label: 'Uptime Guarantee',
    icon: '⚡'
  },
  {
    value: '150+',
    label: 'Countries Worldwide',
    icon: '🌍'
  },
  {
    value: '24/7',
    label: 'Customer Support',
    icon: '💬'
  }
];

export function Stats() {
  return (
    <section className="py-16 bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-blue-100">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
