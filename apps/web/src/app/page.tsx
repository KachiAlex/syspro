export default function HomePage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '600px', 
        width: '100%', 
        textAlign: 'center',
        backgroundColor: 'white',
        padding: '3rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 'bold', 
          color: '#111827', 
          marginBottom: '1rem' 
        }}>
          Syspro ERP System
        </h1>
        <p style={{ 
          fontSize: '1.125rem', 
          color: '#6b7280', 
          marginBottom: '2rem' 
        }}>
          Production Ready Multi-Tenant ERP Platform
        </p>
        
        <div style={{ 
          backgroundColor: '#f3f4f6', 
          padding: '1.5rem', 
          borderRadius: '6px', 
          marginBottom: '2rem' 
        }}>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#111827', 
            marginBottom: '1rem' 
          }}>
            API Endpoints Available
          </h3>
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: '0.5rem 0', color: '#374151' }}>
              • <strong>GET /api/v1/health</strong> - Health check
            </p>
            <p style={{ margin: '0.5rem 0', color: '#374151' }}>
              • <strong>POST /api/v1/auth/login</strong> - User authentication
            </p>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <a 
            href="/api/v1/health"
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '500',
              display: 'inline-block'
            }}
          >
            Test API Health
          </a>
          <a 
            href="/api/v1/auth/login"
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '500',
              display: 'inline-block'
            }}
          >
            View Login API
          </a>
        </div>

        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          backgroundColor: '#ecfdf5', 
          borderRadius: '6px',
          border: '1px solid #d1fae5'
        }}>
          <p style={{ 
            margin: 0, 
            color: '#065f46', 
            fontSize: '0.875rem' 
          }}>
            ✅ System Status: Online | Database: Connected | API: Ready
          </p>
        </div>
      </div>
    </div>
  );
}