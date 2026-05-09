import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../modules/user/entities/user.entity';

export async function seedUsers(dataSource: DataSource) {
  const repo = dataSource.getRepository(User);

  // Password mặc định: "Password123!" (12 salt rounds)
  const hash = await bcrypt.hash('Password123!', 12);

  const users: Partial<User>[] = [
    {
      email: 'admin@electroshop.vn',
      password: hash,
      fullName: 'Admin Hệ thống',
      phone: '0901234567',
      address: '123 Đinh Tiên Hoàng, Phường 3, Quận Bình Thạnh, TP.HCM',
      role: UserRole.ADMIN,
      isActive: true,
    },
    {
      email: 'nguyen.van.an@gmail.com',
      password: hash,
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
      address: '45 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM',
      role: UserRole.CUSTOMER,
      isActive: true,
    },
    {
      email: 'tran.thi.bich@gmail.com',
      password: hash,
      fullName: 'Trần Thị Bích',
      phone: '0987654321',
      address: '88 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
      role: UserRole.CUSTOMER,
      isActive: true,
    },
    {
      email: 'le.minh.cuong@gmail.com',
      password: hash,
      fullName: 'Lê Minh Cường',
      phone: '0933445566',
      address: '12 Trần Hưng Đạo, Phường Phạm Ngũ Lão, Quận 1, TP.HCM',
      role: UserRole.CUSTOMER,
      isActive: true,
    },
    {
      email: 'pham.ngoc.dung@gmail.com',
      password: hash,
      fullName: 'Phạm Ngọc Dung',
      phone: '0978889900',
      address: '200 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP.HCM',
      role: UserRole.CUSTOMER,
      isActive: false, // tài khoản bị khoá để test
    },
  ];

  for (const data of users) {
    const existing = await repo.findOneBy({ email: data.email });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  [users] ✔ Inserted: ${data.email} (${data.role})`);
    } else {
      console.log(`  [users] — Skipped (đã tồn tại): ${data.email}`);
    }
  }

  console.log('  [users] 💡 Mật khẩu mặc định cho tất cả: Password123!');
}