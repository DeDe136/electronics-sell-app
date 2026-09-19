import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { StorageService } from '../storage/storage.service';
import { User, UserRole } from '../user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let storageService: { buildPublicUrl: jest.Mock };

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: 'user@example.com',
      password: 'hashed-password',
      fullName: 'Nguyen Van A',
      role: UserRole.CUSTOMER,
      avatarUrl: 'http://minio/avatars/nov.jpg',
      isActive: true,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (user) => ({ id: 'user-1', ...user })),
    };
    jwtService = {
      sign: jest.fn(() => 'signed-jwt-token'),
    };
    storageService = {
      buildPublicUrl: jest.fn((key: string) => `http://minio/${key}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());

      await expect(
        service.register({
          email: 'user@example.com',
          password: 'securePassword123',
          fullName: 'Nguyen Van A',
        }),
      ).rejects.toThrow(ConflictException);

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('hashes the password and returns a signed token for a new user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const hashSpy = jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('hashed-password' as never);

      const result = await service.register({
        email: 'new@example.com',
        password: 'securePassword123',
        fullName: 'Nguyen Van B',
      });

      expect(hashSpy).toHaveBeenCalledWith('securePassword123', 12);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          password: 'hashed-password',
        }),
      );
      expect(userRepo.save).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user).toEqual(
        expect.objectContaining({ email: 'new@example.com' }),
      );
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'missing@example.com',
          password: 'whatever123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is disabled', async () => {
      userRepo.findOne.mockResolvedValue(buildUser({ isActive: false }));
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'securePassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns a signed token when credentials are valid', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login({
        email: 'user@example.com',
        password: 'securePassword123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: 'user@example.com' }),
      );
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.id).toBe('user-1');
    });
  });
});
