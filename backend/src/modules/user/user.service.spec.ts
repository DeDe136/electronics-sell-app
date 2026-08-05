import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { StorageService } from '../storage/storage.service';

describe('UserService', () => {
  let service: UserService;
  let userRepo: Record<string, jest.Mock>;
  let storageService: Record<string, jest.Mock>;

  beforeEach(async () => {
    userRepo = {
      findOneOrFail: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(async (u) => u),
    };
    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getProfile', () => {
    it('returns the user by id', async () => {
      userRepo.findOneOrFail.mockResolvedValue({ id: 'user-1' });

      const result = await service.getProfile('user-1');

      expect(userRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual({ id: 'user-1' });
    });
  });

  describe('updateProfile', () => {
    it('updates the given fields and returns the fresh profile', async () => {
      userRepo.findOneOrFail.mockResolvedValue({
        id: 'user-1',
        fullName: 'Updated Name',
      });

      const result = await service.updateProfile('user-1', {
        fullName: 'Updated Name',
      });

      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        fullName: 'Updated Name',
      });
      expect(result.fullName).toBe('Updated Name');
    });
  });

  describe('updateAvatar', () => {
    it('deletes the old avatar and uploads the new one', async () => {
      userRepo.findOneOrFail
        .mockResolvedValueOnce({ id: 'user-1', avatarKey: 'avatars/old.jpg' })
        .mockResolvedValueOnce({ id: 'user-1', avatarKey: 'avatars/new.jpg' });
      storageService.uploadFile.mockResolvedValue({
        url: 'http://x/new.jpg',
        key: 'avatars/new.jpg',
      });

      const file = { originalname: 'new.jpg' } as any;
      const result = await service.updateAvatar('user-1', file);

      expect(storageService.deleteFile).toHaveBeenCalledWith('avatars/old.jpg');
      expect(storageService.uploadFile).toHaveBeenCalledWith(file, 'avatars');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        avatarUrl: 'http://x/new.jpg',
        avatarKey: 'avatars/new.jpg',
      });
      expect(result.avatarKey).toBe('avatars/new.jpg');
    });

    it('skips deleting when there is no existing avatar', async () => {
      userRepo.findOneOrFail
        .mockResolvedValueOnce({ id: 'user-1', avatarKey: null })
        .mockResolvedValueOnce({ id: 'user-1', avatarKey: 'avatars/new.jpg' });
      storageService.uploadFile.mockResolvedValue({
        url: 'http://x/new.jpg',
        key: 'avatars/new.jpg',
      });

      await service.updateAvatar('user-1', {} as any);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('throws BadRequestException when the user has active orders', async () => {
      userRepo.findOneOrFail.mockResolvedValue({
        id: 'user-1',
        orders: [{ status: 'pending' }],
      });

      await expect(service.deleteUser('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepo.remove).not.toHaveBeenCalled();
    });

    it('allows deletion when all orders are completed or cancelled', async () => {
      const user = {
        id: 'user-1',
        orders: [{ status: 'completed' }, { status: 'cancelled' }],
        avatarKey: null,
      };
      userRepo.findOneOrFail.mockResolvedValue(user);

      await service.deleteUser('user-1');

      expect(userRepo.remove).toHaveBeenCalledWith(user);
    });

    it('deletes the avatar from storage before removing the user', async () => {
      const user = { id: 'user-1', orders: [], avatarKey: 'avatars/pic.jpg' };
      userRepo.findOneOrFail.mockResolvedValue(user);

      await service.deleteUser('user-1');

      expect(storageService.deleteFile).toHaveBeenCalledWith('avatars/pic.jpg');
      expect(userRepo.remove).toHaveBeenCalledWith(user);
    });
  });
});
