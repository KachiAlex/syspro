/**
 * Simple test page to verify deployment is working
 */

export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🎉 Deployment Successful!
        </h1>
        <p className="text-gray-600 mb-4">
          Your Syspro ERP application is running on Vercel.
        </p>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <h2 className="font-semibold text-gray-900 mb-2">Test API Endpoints:</h2>
          <div className="space-y-2 text-sm">
            <div>
              <a 
                href="/api/health" 
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                /api/health
              </a>
            </div>
            <div>
              <a 
                href="/api/v1/health" 
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                /api/v1/health
              </a>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <a 
            href="/login" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
}