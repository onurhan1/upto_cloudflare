// AI utilities for generating summaries and suggestions
// Uses OpenAI API for intelligent analysis

import { Env } from '../types';
import { getUserApiKey } from '../api/routes/settings';

export interface AISummary {
  summary: string;
  rootCause: string;
  affectedSystems: string[];
  recommendedActions: string[];
}

export interface AISuggestions {
  checkInterval: number;
  timeout: number;
  retryCount: number;
  idealParameters: {
    expectedStatusCode?: number;
    expectedKeyword?: string;
  };
  reasoning: string;
}

/**
 * Generate AI summary for an incident
 */
export async function generateIncidentSummary(
  incidentId: string,
  serviceName: string,
  serviceUrl: string,
  incidentTitle: string,
  incidentDescription: string | null,
  recentChecks: Array<{
    status: string;
    response_time_ms: number | null;
    status_code: number | null;
    error_message: string | null;
    checked_at: number;
    anomaly_detected?: boolean;
    anomaly_type?: string;
  }>,
  env: Env,
  userId?: string // Optional: user ID to fetch API key from database
): Promise<string | null> {
  // Get API key: first try user's API key from database, then fallback to env
  let apiKey: string | null = null;
  
  if (userId) {
    apiKey = await getUserApiKey(env.DB, userId, 'openai', env);
  }
  
  // Fallback to environment variable if user doesn't have a key
  if (!apiKey) {
    apiKey = env.OPENAI_API_KEY || null;
  }
  
  if (!apiKey) {
    console.warn('OpenAI API key not configured (neither user key nor env var), skipping AI summary generation');
    return null;
  }

  try {
    // Build context from recent checks
    const checkHistory = recentChecks.slice(0, 10).map((check) => ({
      status: check.status,
      responseTime: check.response_time_ms,
      statusCode: check.status_code,
      error: check.error_message,
      timestamp: new Date(check.checked_at * 1000).toISOString(),
      anomaly: check.anomaly_detected ? check.anomaly_type : null,
    }));

    const prompt = `You are an incident analysis assistant. Analyze the following incident and provide a structured summary.

Service: ${serviceName}
URL: ${serviceUrl}
Incident Title: ${incidentTitle}
Description: ${incidentDescription || 'No description provided'}

Recent Health Check History:
${JSON.stringify(checkHistory, null, 2)}

Please provide a JSON response with the following structure:
{
  "summary": "Brief summary of the incident (2-3 sentences)",
  "rootCause": "Most likely root cause based on the data",
  "affectedSystems": ["List of affected systems/components"],
  "recommendedActions": ["Action 1", "Action 2", "Action 3"]
}

Be concise and technical. Focus on actionable insights.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using mini for cost efficiency
        messages: [
          {
            role: 'system',
            content:
              'You are a technical incident analysis assistant. Provide structured, actionable insights in JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return JSON.stringify(parsed, null, 2);
      }
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using raw text');
    }

    return content;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return null;
  }
}

/**
 * Generate AI suggestions for service monitoring parameters
 */
export async function generateServiceSuggestions(
  serviceName: string,
  serviceType: string,
  serviceUrl: string,
  currentInterval: number,
  currentTimeout: number,
  historicalChecks: Array<{
    status: string;
    response_time_ms: number | null;
    status_code: number | null;
    checked_at: number;
  }>,
  env: Env,
  userId?: string // Optional: user ID to fetch API key from database
): Promise<AISuggestions | null> {
  // Get API key: first try user's API key from database, then fallback to env
  let apiKey: string | null = null;
  
  if (userId) {
    apiKey = await getUserApiKey(env.DB, userId, 'openai', env);
  }
  
  // Fallback to environment variable if user doesn't have a key
  if (!apiKey) {
    apiKey = env.OPENAI_API_KEY || null;
  }
  
  if (!apiKey) {
    console.warn('OpenAI API key not configured (neither user key nor env var), skipping AI suggestions');
    return null;
  }

  try {
    // Calculate statistics
    const successfulChecks = historicalChecks.filter((c) => c.status === 'up' && c.response_time_ms !== null);
    const avgResponseTime =
      successfulChecks.length > 0
        ? successfulChecks.reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / successfulChecks.length
        : 0;
    const maxResponseTime =
      successfulChecks.length > 0
        ? Math.max(...successfulChecks.map((c) => c.response_time_ms || 0))
        : 0;
    const minResponseTime =
      successfulChecks.length > 0
        ? Math.min(...successfulChecks.map((c) => c.response_time_ms || 0))
        : 0;
    const uptimePercentage = (successfulChecks.length / historicalChecks.length) * 100;

    const prompt = `You are a monitoring configuration expert. Analyze the following service and suggest optimal monitoring parameters.

Service: ${serviceName}
Type: ${serviceType}
URL: ${serviceUrl}
Current Check Interval: ${currentInterval} seconds
Current Timeout: ${currentTimeout}ms

Statistics (from ${historicalChecks.length} recent checks):
- Average Response Time: ${avgResponseTime.toFixed(2)}ms
- Min Response Time: ${minResponseTime}ms
- Max Response Time: ${maxResponseTime}ms
- Uptime: ${uptimePercentage.toFixed(2)}%

Please provide a JSON response with the following structure:
{
  "checkInterval": <suggested interval in seconds (10-3600)>,
  "timeout": <suggested timeout in ms (1000-60000)>,
  "retryCount": <suggested retry count (0-5)>,
  "idealParameters": {
    "expectedStatusCode": <suggested status code or null>,
    "expectedKeyword": <suggested keyword or null>
  },
  "reasoning": "Brief explanation of recommendations"
}

Consider:
- Response time patterns
- Service stability
- Cost vs. monitoring frequency trade-offs
- Best practices for ${serviceType} services`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a monitoring configuration expert. Provide optimal monitoring parameters based on service characteristics and historical data.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          checkInterval: parsed.checkInterval || currentInterval,
          timeout: parsed.timeout || currentTimeout,
          retryCount: parsed.retryCount || 0,
          idealParameters: parsed.idealParameters || {},
          reasoning: parsed.reasoning || 'No reasoning provided',
        };
      }
    } catch (parseError) {
      console.warn('Failed to parse AI suggestions as JSON');
    }

    // Fallback: return default suggestions
    return {
      checkInterval: currentInterval,
      timeout: currentTimeout,
      retryCount: 0,
      idealParameters: {},
      reasoning: 'Unable to generate AI suggestions. Using current parameters.',
    };
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    return null;
  }
}

