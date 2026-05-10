import {
  Controller, Get, Patch, Body, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiConsumes,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { UserService, UpdateUserDto } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/roles.decorator';
import { User } from './entities/user.entity';

class UserProfileResponse {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  address: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@ApiTags('User')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Chưa đăng nhập hoặc token không hợp lệ' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Lấy thông tin cá nhân',
    description: 'Trả về thông tin đầy đủ của người dùng đang đăng nhập.',
  })
  @ApiOkResponse({ description: 'Thông tin người dùng', type: UserProfileResponse })
  getProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Cập nhật thông tin cá nhân',
    description: 'Cập nhật họ tên, số điện thoại hoặc địa chỉ. Chỉ truyền các trường cần thay đổi.',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'Thông tin đã được cập nhật', type: UserProfileResponse })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    return this.userService.updateProfile(user.id, dto);
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({
    summary: 'Cập nhật ảnh đại diện',
    description: 'Upload ảnh đại diện mới (multipart/form-data). Ảnh cũ sẽ bị xóa khỏi storage. Định dạng hỗ trợ: JPG, PNG, WebP. Kích thước tối đa: 5MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File ảnh đại diện',
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh (JPG, PNG, WebP — tối đa 5MB)',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Avatar đã được cập nhật thành công', type: UserProfileResponse })
  @ApiBadRequestResponse({ description: 'File không hợp lệ hoặc thiếu file' })
  updateAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.updateAvatar(user.id, file);
  }
}