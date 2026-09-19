import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly storageService: StorageService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    // Dùng lại StorageService.buildPublicUrl() thay vì tự đọc
    // process.env.MINIO_* — nhánh minio (URL tuyệt
    // đối), nhánh aws tự trả về "/api/images/avatars/nov.jpg" (khớp đúng
    // key thật, không cần biết bucket/region ở đây, StorageService lo hết).
    const avatarKey = 'avatars/nov.jpg';
    const user = this.userRepo.create({
      ...dto,
      password: hashed,
      avatarUrl: this.storageService.buildPublicUrl(avatarKey),
      avatarKey,
    });
    await this.userRepo.save(user);

    return this.signToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account disabled');

    return this.signToken(user);
  }

  private signToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}
