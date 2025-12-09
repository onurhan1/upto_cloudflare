// Form validation utilities

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationRule[];
}

export function validateField(value: any, rules: ValidationRule): string | null {
  if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return 'This field is required';
  }

  if (value && typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return `Minimum length is ${rules.minLength} characters`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `Maximum length is ${rules.maxLength} characters`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return 'Invalid format';
    }
  }

  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
}

export function validateForm(data: Record<string, any>, schema: ValidationSchema): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];
    const rules = Array.isArray(rule) ? rule : [rule];

    for (const r of rules) {
      const error = validateField(value, r);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  }

  return errors;
}

// Common validation schemas
export const serviceValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  type: {
    required: true,
  },
  url_or_host: {
    required: true,
    pattern: /^https?:\/\/.+\..+|^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/,
    custom: (value: string) => {
      if (!value) return null;
      if (!value.includes('.') && !value.startsWith('http')) {
        return 'Please enter a valid URL or hostname';
      }
      return null;
    },
  },
  check_interval_seconds: {
    required: true,
    custom: (value: number) => {
      if (value < 10) return 'Check interval must be at least 10 seconds';
      if (value > 86400) return 'Check interval cannot exceed 24 hours';
      return null;
    },
  },
  timeout_ms: {
    required: true,
    custom: (value: number) => {
      if (value < 1000) return 'Timeout must be at least 1000ms';
      if (value > 60000) return 'Timeout cannot exceed 60 seconds';
      return null;
    },
  },
  expected_status_code: {
    custom: (value: any) => {
      if (value && (value < 100 || value > 599)) {
        return 'Status code must be between 100 and 599';
      }
      return null;
    },
  },
};

export const statusPageValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  slug: {
    required: true,
    pattern: /^[a-z0-9-]+$/,
    minLength: 1,
    maxLength: 50,
    custom: (value: string) => {
      if (value && (value.startsWith('-') || value.endsWith('-'))) {
        return 'Slug cannot start or end with a hyphen';
      }
      return null;
    },
  },
  description: {
    maxLength: 500,
  },
};

export const incidentValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 1,
    maxLength: 200,
  },
  description: {
    maxLength: 1000,
  },
};

