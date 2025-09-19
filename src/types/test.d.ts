/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

declare namespace jest {
  interface Mock<T = any, Y extends any[] = any[], C = any> extends MockInstance<T, Y, C> {
    new (...args: Y): T;
    (...args: Y): T;
  }

  interface MockedFunction<T extends (...args: any[]) => any> extends Mock<ReturnType<T>, Parameters<T>> {
    new (...args: Parameters<T>): T;
    (...args: Parameters<T>): ReturnType<T>;
  }
}

// Global test utilities
declare global {
  var mockFetch: jest.MockedFunction<typeof fetch>;
}

export {};