import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email đăng ký (phải là email hợp lệ, duy nhất trong hệ thống)' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123', description: 'Mật khẩu tối thiểu 8 ký tự' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Họ tên đầy đủ' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: '0901234567', description: 'Số điện thoại (tuỳ chọn)' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email đã đăng ký' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123', description: 'Mật khẩu' })
  @IsString()
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({
    description: 'Thông tin người dùng',
    example: {
      id: 'uuid-...',
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
      role: 'customer',
    },
  })
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}