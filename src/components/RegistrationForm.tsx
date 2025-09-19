'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';

// Form validation schema
const registrationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenantName: z.string().min(1, 'Tenant name is required').max(255, 'Tenant name must be less than 255 characters'),
});

type RegistrationData = z.infer<typeof registrationSchema>;

export default function RegistrationForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState<RegistrationData>({
    username: '',
    password: '',
    tenantName: '',
  });

  const [errors, setErrors] = useState<Partial<RegistrationData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof RegistrationData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const result = registrationSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Partial<RegistrationData> = {};
      result.error.issues.forEach(error => {
        if (error.path.length > 0) {
          const field = error.path[0] as keyof RegistrationData;
          fieldErrors[field] = error.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/v1/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Automatically log in the user with the new account
      const loginResult = await login(formData.username, formData.password, data.tenant.id);

      if (loginResult.success) {
        setSuccess(true);
        setFormData({ username: '', password: '', tenantName: '' });

        // Redirect to dashboard after successful registration and login
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        // If login fails, still show success but suggest manual login
        setSuccess(true);
        setFormData({ username: '', password: '', tenantName: '' });
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="text-green-600 text-xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to FlowSEO!</h2>
          <p className="text-gray-600">Your account has been created and you're now logged in.</p>
          <p className="text-gray-500 text-sm mt-2">Taking you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Create Account</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.username ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your username"
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-600">{errors.username}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your password"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="tenantName" className="block text-sm font-medium text-gray-700 mb-1">
            Team/Organization Name
          </label>
          <input
            type="text"
            id="tenantName"
            name="tenantName"
            value={formData.tenantName}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.tenantName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your team or organization name"
          />
          {errors.tenantName && (
            <p className="mt-1 text-sm text-red-600">{errors.tenantName}</p>
          )}
        </div>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-2 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}