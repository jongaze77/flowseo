// @ts-nocheck
import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
jest.mock('../../../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn()
    },
    project: {
      findFirst: jest.fn()
    },
    keywordList: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    },
    keyword: {
      update: jest.fn(),
      createMany: jest.fn()
    },
    $disconnect: jest.fn()
  }))
}));

jest.mock('../../../../../../../../lib/auth/session', () => ({
  verifyAndDecodeToken: jest.fn()
}));

jest.mock('../../../../../../../../lib/services/csvParser', () => ({
  csvParser: {
    parseFile: jest.fn()
  }
}));

jest.mock('../../../../../../../../lib/services/externalToolMapper', () => ({
  externalToolMapper: {
    detectTool: jest.fn(),
    mapRowData: jest.fn()
  }
}));

jest.mock('../../../../../../../../lib/services/keywordMerger', () => ({
  KeywordMerger: jest.fn().mockImplementation(() => ({
    mergeKeywords: jest.fn(),
    generateAuditTrail: jest.fn()
  }))
}));

import { PrismaClient } from '../../../../../../../../generated/prisma';
import { verifyAndDecodeToken } from '../../../../../../../../lib/auth/session';
import { csvParser } from '../../../../../../../../lib/services/csvParser';
import { externalToolMapper } from '../../../../../../../../lib/services/externalToolMapper';
import { KeywordMerger } from '../../../../../../../../lib/services/keywordMerger';

describe('/api/v1/projects/[id]/keywords/import', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockUser: any;
  let mockProject: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

    mockUser = {
      id: 'user-1',
      tenant_id: 'tenant-1',
      tenant: {
        id: 'tenant-1',
        name: 'Test Tenant'
      }
    };

    mockProject = {
      id: 'project-1',
      name: 'Test Project',
      default_region: 'UK',
      tenant_id: 'tenant-1'
    };

    verifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' }
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.project.findFirst.mockResolvedValue(mockProject);
  });

  describe('POST', () => {
    it('should handle CSV file upload and start import process', async () => {
      const csvContent = 'keyword,search volume\ntest keyword,1000';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('data', JSON.stringify({
        detectTool: true,
        conflictResolution: 'manual',
        allowRegionMismatch: false
      }));

      const request = new NextRequest('http://localhost/api/v1/projects/project-1/keywords/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Cookie': 'auth-token=valid-token'
        }
      });

      // Mock CSV parsing
      csvParser.parseFile.mockResolvedValue({
        data: [{ keyword: 'test keyword', 'search volume': '1000' }],
        headers: ['keyword', 'search volume'],
        errors: [],
        meta: {
          rowCount: 1,
          fileSize: csvContent.length,
          hasHeaders: true
        }
      });

      // Mock tool detection
      externalToolMapper.detectTool.mockReturnValue({
        detectedTool: 'semrush',
        confidence: 0.8,
        mappings: [
          { sourceColumn: 'keyword', targetField: 'keyword', required: true },
          { sourceColumn: 'search volume', targetField: 'searchVolume', required: false }
        ],
        unmappedColumns: [],
        errors: []
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'project-1' }) });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.importId).toBeDefined();
      expect(result.statusUrl).toContain('/import/status/');
    });

    it('should reject requests without valid authentication', async () => {
      verifyAndDecodeToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/v1/projects/project-1/keywords/import', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'project-1' }) });
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe('Authentication required');
    });

    it('should reject requests for non-existent projects', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const file = new File(['keyword\ntest'], 'test.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost/api/v1/projects/project-1/keywords/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Cookie': 'auth-token=valid-token'
        }
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'project-1' }) });
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe('Project not found or access denied');
    });

    it('should reject requests without CSV file', async () => {
      const formData = new FormData();
      formData.append('data', JSON.stringify({ detectTool: true }));

      const request = new NextRequest('http://localhost/api/v1/projects/project-1/keywords/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Cookie': 'auth-token=valid-token'
        }
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'project-1' }) });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('CSV file is required');
    });

    it('should validate request data format', async () => {
      const file = new File(['keyword\ntest'], 'test.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('data', 'invalid-json');

      const request = new NextRequest('http://localhost/api/v1/projects/project-1/keywords/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Cookie': 'auth-token=valid-token'
        }
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'project-1' }) });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Invalid request data format');
    });

    it('should handle project ownership validation', async () => {
      // Mock project owned by different tenant
      mockPrisma.project.findFirst.mockResolvedValue({
        ...mockProject,
        tenant_id: 'different-tenant'
      });

      const file = new File(['keyword\ntest'], 'test.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost/api/v1/projects/project-1/keywords/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Cookie': 'auth-token=valid-token'
        }
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'project-1' }) });
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe('Project not found or access denied');
    });
  });
});