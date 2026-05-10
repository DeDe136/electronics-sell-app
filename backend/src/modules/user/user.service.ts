// user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nguyen Van B', description: 'Họ tên mới (tối đa 100 ký tự)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0909999888', description: 'Số điện thoại mới (tối đa 20 ký tự)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: '456 Le Van Sy, Phuong 14, Quan 3, TP.HCM',
    description: 'Địa chỉ mặc định (tối đa 500 ký tự)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly storageService: StorageService,
  ) {}

  async getProfile(userId: string): Promise<User> {
    return this.userRepo.findOneOrFail({ where: { id: userId } });
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<User> {
    await this.userRepo.update(userId, dto);
    return this.getProfile(userId);
  }

  async updateAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.getProfile(userId);
    // Xóa avatar cũ
    if (user.avatarKey) {
      await this.storageService.deleteFile(user.avatarKey).catch(() => null);
    }
    const result = await this.storageService.uploadFile(file, 'avatars');
    await this.userRepo.update(userId, { avatarUrl: result.url, avatarKey: result.key });
    return this.getProfile(userId);
  }
}