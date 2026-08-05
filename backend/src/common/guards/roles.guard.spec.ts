import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const buildContext = (user?: { role?: string }): ExecutionContext =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(buildContext({ role: 'customer' }));

    expect(result).toBe(true);
  });

  it('allows access when the user role is included in the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'customer']);

    const result = guard.canActivate(buildContext({ role: 'customer' }));

    expect(result).toBe(true);
  });

  it('denies access when the user role is not included in the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    const result = guard.canActivate(buildContext({ role: 'customer' }));

    expect(result).toBe(false);
  });

  it('denies access when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    const result = guard.canActivate(buildContext(undefined));

    expect(result).toBe(false);
  });
});
