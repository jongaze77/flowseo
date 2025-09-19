import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../../../generated/prisma';

const prisma = new PrismaClient();

interface RouteParams {
  params: Promise<{
    tenantId: string;
    userId: string;
  }>;
}

// DELETE /api/v1/tenants/:tenantId/users/:userId - Remove user from tenant
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId, userId } = await params;

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Find the user and verify they belong to this tenant
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenant_id: tenantId
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in this organization' },
        { status: 404 }
      );
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json(
      { message: 'User removed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}