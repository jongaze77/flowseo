/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeChecked(): R;
      toHaveValue(value: string | number | string[]): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
      toHaveClass(...classNames: string[]): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toHaveTextContent(text: string | RegExp): R;
      toContainElement(element: HTMLElement | null): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveFocus(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toBeRequired(): R;
      toBePartiallyChecked(): R;
      toHaveDescription(text?: string | RegExp): R;
      toHaveAccessibleName(text?: string | RegExp): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
    }
  }
}