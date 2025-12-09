// Health check utilities for different service types

/**
 * DNS health check
 */
export async function checkDns(
  hostname: string,
  timeoutMs: number
): Promise<{
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  errorMessage: string | null;
  records?: any;
}> {
  const startTime = Date.now();

  try {
    // Use Cloudflare's DNS over HTTPS API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/dns-json',
      },
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'down',
        responseTime,
        errorMessage: `DNS query failed: ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
      return {
        status: 'up',
        responseTime,
        errorMessage: null,
        records: data.Answer,
      };
    } else {
      return {
        status: 'down',
        responseTime,
        errorMessage: `DNS resolution failed: ${data.Status}`,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'down',
      responseTime,
      errorMessage: error.message || 'DNS check failed',
    };
  }
}

/**
 * SSL certificate check
 */
export async function checkSsl(
  hostname: string,
  timeoutMs: number
): Promise<{
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  errorMessage: string | null;
  daysUntilExpiry?: number;
}> {
  const startTime = Date.now();

  // Try HEAD first, then GET if HEAD fails (some servers don't support HEAD)
  const url = hostname.startsWith('https://') ? hostname : `https://${hostname}`;

  // Remove trailing slash if present (can cause issues with some servers)
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;

  // Try HEAD first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(cleanUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow', // Follow redirects
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    console.log(`[SSL Check] ${cleanUrl} - Status: ${response.status}, OK: ${response.ok}`);

    // Note: Cloudflare Workers can't directly access SSL certificate details
    // We can only check if HTTPS connection succeeds
    // For full SSL certificate checking, you'd need an external service

    // Consider 2xx and 3xx status codes as successful SSL connection
    // 3xx redirects are normal and indicate SSL is working
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      // SSL connection successful (2xx or 3xx redirect)
      console.log(`[SSL Check] ${cleanUrl} - Returning UP (status: ${response.status})`);
      return {
        status: 'up',
        responseTime,
        errorMessage: null,
        daysUntilExpiry: undefined,
      };
    } else if (response.status >= 400 && response.status < 500) {
      // 4xx errors: SSL works but server returned client error (still SSL is OK)
      console.log(`[SSL Check] ${cleanUrl} - Returning UP (4xx: ${response.status})`);
      return {
        status: 'up',
        responseTime,
        errorMessage: `HTTPS connection successful but server returned ${response.status}`,
        daysUntilExpiry: undefined,
      };
    } else {
      // 5xx errors: SSL works but server error
      console.log(`[SSL Check] ${cleanUrl} - Returning DEGRADED (5xx: ${response.status})`);
      return {
        status: 'degraded',
        responseTime,
        errorMessage: `HTTPS connection successful but server error: ${response.status}`,
        daysUntilExpiry: undefined,
      };
    }
  } catch (headError: any) {
    console.log(`[SSL Check] ${cleanUrl} - HEAD failed: ${headError.message}, trying GET...`);
    // HEAD failed, try GET as fallback
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(cleanUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
        },
      });

      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;

      console.log(`[SSL Check] ${cleanUrl} - GET Status: ${response.status}, OK: ${response.ok}`);

      // Consider 2xx and 3xx status codes as successful SSL connection
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        console.log(`[SSL Check] ${cleanUrl} - Returning UP (GET status: ${response.status})`);
        return {
          status: 'up',
          responseTime,
          errorMessage: null,
          daysUntilExpiry: undefined,
        };
      } else if (response.status >= 400 && response.status < 500) {
        console.log(`[SSL Check] ${cleanUrl} - Returning UP (GET 4xx: ${response.status})`);
        return {
          status: 'up',
          responseTime,
          errorMessage: `HTTPS connection successful but server returned ${response.status}`,
          daysUntilExpiry: undefined,
        };
      } else {
        console.log(`[SSL Check] ${cleanUrl} - Returning DEGRADED (GET 5xx: ${response.status})`);
        return {
          status: 'degraded',
          responseTime,
          errorMessage: `HTTPS connection successful but server error: ${response.status}`,
          daysUntilExpiry: undefined,
        };
      }
    } catch (getError: any) {
      const responseTime = Date.now() - startTime;

      console.log(`[SSL Check] ${cleanUrl} - GET failed: ${getError.message}`);

      // Check if it's an SSL error
      if (getError.message?.includes('certificate') || getError.message?.includes('SSL') || getError.message?.includes('TLS')) {
        return {
          status: 'down',
          responseTime,
          errorMessage: `SSL error: ${getError.message}`,
        };
      }

      return {
        status: 'down',
        responseTime,
        errorMessage: getError.message || 'SSL check failed',
      };
    }
  }
}

/**
 * Ping check (ICMP simulation via HTTP)
 * Note: True ICMP ping is not possible in Cloudflare Workers
 * We simulate it with a fast HTTP request
 */
export async function checkPing(
  hostname: string,
  timeoutMs: number
): Promise<{
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  errorMessage: string | null;
}> {
  const startTime = Date.now();

  try {
    // Try HTTP first, then HTTPS
    const urls = [
      hostname.startsWith('http') ? hostname : `http://${hostname}`,
      hostname.startsWith('http') ? hostname : `https://${hostname}`,
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;

        if (response.ok || response.status < 500) {
          return {
            status: 'up',
            responseTime,
            errorMessage: null,
          };
        }
      } catch (err) {
        // Try next URL
        continue;
      }
    }

    // All attempts failed
    const responseTime = Date.now() - startTime;
    return {
      status: 'down',
      responseTime,
      errorMessage: 'Host not reachable',
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'down',
      responseTime,
      errorMessage: error.message || 'Ping check failed',
    };
  }
}

