/**
 * Comprehensive API Endpoint Testing Script
 * Tests all endpoints with authentication and CSRF protection
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  requiresAuth: boolean;
  requiresCSRF: boolean;
}

class APITester {
  private baseUrl = 'http://localhost:5000';
  private sessionCookie: string = '';
  private csrfToken: string = '';
  private results: TestResult[] = [];

  async runAllTests() {
    console.log('🚀 Starting comprehensive API endpoint tests...\n');

    // Test unauthenticated endpoints
    await this.testUnauthenticatedEndpoints();

    // Test authentication flow
    await this.testAuthentication();

    // Test authenticated endpoints
    await this.testCRMEndpoints();
    await this.testQuotationEndpoints();
    await this.testInvoiceEndpoints();
    await this.testExpenseEndpoints();
    await this.testEmployeeEndpoints();
    await this.testTaskEndpoints();
    await this.testNotificationEndpoints();
    await this.testServicesEndpoints();
    await this.testAnalyticsEndpoints();

    // Test CSRF protection
    await this.testCSRFProtection();

    // Print summary
    this.printSummary();
  }

  private async testUnauthenticatedEndpoints() {
    console.log('📋 Testing unauthenticated endpoints...');
    
    await this.testEndpoint('GET', '/api/health', false, false);
    await this.testEndpoint('GET', '/api/config', false, false);
    await this.testEndpoint('GET', '/api/ready', false, false);
  }

  private async testAuthentication() {
    console.log('\n🔐 Testing authentication flow...');
    
    // Test login
    const loginResult = await this.makeRequest('POST', '/api/login', {
      username: 'admin',
      password: 'admin123'
    }, false, false);

    if (loginResult.success) {
      console.log('✅ Login successful');
      
      // Extract session cookie from login response
      const setCookieHeader = loginResult.headers?.get('set-cookie');
      if (setCookieHeader) {
        this.sessionCookie = setCookieHeader.split(';')[0];
      }

      // Fetch CSRF token
      const csrfResult = await this.makeRequest('GET', '/api/csrf-token', null, false, false);
      if (csrfResult.success && csrfResult.data?.csrfToken) {
        this.csrfToken = csrfResult.data.csrfToken;
        console.log('✅ CSRF token fetched');
      }
    }

    // Test get user endpoint
    await this.testEndpoint('GET', '/api/user', true, false);
  }

  private async testCRMEndpoints() {
    console.log('\n👥 Testing CRM endpoints...');
    
    await this.testEndpoint('GET', '/api/clients', true, false);
    await this.testEndpoint('POST', '/api/clients', true, true, {
      name: 'Test Client',
      email: 'test@example.com',
      phone: '1234567890',
      company: 'Test Company',
      type: 'business',
      status: 'active'
    });
  }

  private async testQuotationEndpoints() {
    console.log('\n📄 Testing quotation endpoints...');
    
    await this.testEndpoint('GET', '/api/quotations', true, false);
  }

  private async testInvoiceEndpoints() {
    console.log('\n🧾 Testing invoice endpoints...');
    
    await this.testEndpoint('GET', '/api/invoices', true, false);
  }

  private async testExpenseEndpoints() {
    console.log('\n💰 Testing expense endpoints...');
    
    await this.testEndpoint('GET', '/api/expenses', true, false);
    await this.testEndpoint('GET', '/api/expense-categories', true, false);
  }

  private async testEmployeeEndpoints() {
    console.log('\n👨‍💼 Testing employee endpoints...');
    
    await this.testEndpoint('GET', '/api/employees', true, false);
    await this.testEndpoint('GET', '/api/roles', true, false);
  }

  private async testTaskEndpoints() {
    console.log('\n📝 Testing task endpoints...');
    
    await this.testEndpoint('GET', '/api/tasks', true, false);
  }

  private async testNotificationEndpoints() {
    console.log('\n🔔 Testing notification endpoints...');
    
    await this.testEndpoint('GET', '/api/notifications', true, false);
    await this.testEndpoint('GET', '/api/notifications/unread-count', true, false);
  }

  private async testServicesEndpoints() {
    console.log('\n🛠️ Testing services endpoints...');
    
    await this.testEndpoint('GET', '/api/services', true, false);
  }

  private async testAnalyticsEndpoints() {
    console.log('\n📊 Testing analytics endpoints...');
    
    await this.testEndpoint('GET', '/api/analytics/dashboard-stats', true, false);
  }

  private async testCSRFProtection() {
    console.log('\n🛡️ Testing CSRF protection...');
    
    // Try to make a POST request without CSRF token (should fail)
    console.log('Testing POST without CSRF token (should fail)...');
    const result = await this.makeRequest('POST', '/api/clients', {
      name: 'Test',
      email: 'test@test.com'
    }, true, false);

    if (!result.success && result.status === 403) {
      console.log('✅ CSRF protection working - request blocked without token');
      this.results.push({
        endpoint: '/api/clients (no CSRF)',
        method: 'POST',
        status: result.status,
        success: true,
        requiresAuth: true,
        requiresCSRF: true
      });
    } else {
      console.log('❌ CSRF protection NOT working - request should have been blocked');
      this.results.push({
        endpoint: '/api/clients (no CSRF)',
        method: 'POST',
        status: result.status,
        success: false,
        error: 'CSRF protection not enforced',
        requiresAuth: true,
        requiresCSRF: true
      });
    }
  }

  private async testEndpoint(
    method: string,
    endpoint: string,
    requiresAuth: boolean,
    requiresCSRF: boolean,
    body?: any
  ) {
    const result = await this.makeRequest(method, endpoint, body, requiresAuth, requiresCSRF);
    
    this.results.push({
      endpoint,
      method,
      status: result.status,
      success: result.success,
      error: result.error,
      requiresAuth,
      requiresCSRF
    });

    const statusIcon = result.success ? '✅' : '❌';
    const authInfo = requiresAuth ? '[AUTH]' : '';
    const csrfInfo = requiresCSRF ? '[CSRF]' : '';
    console.log(`${statusIcon} ${method} ${endpoint} ${authInfo}${csrfInfo} - ${result.status}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    useAuth: boolean = false,
    useCSRF: boolean = false
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (useAuth && this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    if (useCSRF && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = response.headers.get('content-type');
      let data = null;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      }

      return {
        success: response.ok,
        status: response.status,
        data,
        headers: response.headers
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   ${r.method} ${r.endpoint} - ${r.status} ${r.error || ''}`);
        });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run tests
const tester = new APITester();
tester.runAllTests().catch(console.error);
