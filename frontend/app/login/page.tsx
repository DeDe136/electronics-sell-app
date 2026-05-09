'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

const inputCls = `w-full py-2.5 border rounded-lg text-sm transition-colors
  border-gray-200 dark:border-slate-600
  bg-white dark:bg-slate-800
  text-gray-900 dark:text-slate-100
  placeholder-gray-400 dark:placeholder-slate-500
  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent`;

const labelCls = 'block text-sm font-medium mb-1 text-gray-700 dark:text-slate-200';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab]               = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [loginForm, setLoginForm]   = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    email: '', password: '', confirmPassword: '', fullName: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error('Vui lòng nhập đầy đủ thông tin'); return;
    }
    setLoading(true);
    try {
      const data = await authApi.login(loginForm.email, loginForm.password);
      if (data.accessToken) {
        localStorage.setItem('access_token', data.accessToken);
        toast.success('Đăng nhập thành công!');
        router.push('/');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.email || !registerForm.password || !registerForm.fullName) {
      toast.error('Vui lòng nhập đầy đủ thông tin'); return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp'); return;
    }
    if (registerForm.password.length < 8) {
      toast.error('Mật khẩu phải có ít nhất 8 ký tự'); return;
    }
    setLoading(true);
    try {
      await authApi.register({
        email: registerForm.email,
        password: registerForm.password,
        fullName: registerForm.fullName,
      });
      toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      setTab('login');
      setLoginForm({ email: registerForm.email, password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const EyeBtn = () => (
    <button
      type="button"
      className="absolute right-3 top-1/2 -translate-y-1/2
        text-gray-400 dark:text-slate-500
        hover:text-gray-600 dark:hover:text-slate-300"
      onClick={() => setShowPassword(!showPassword)}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4
      bg-gradient-to-br from-blue-50 to-indigo-100
      dark:from-[#0d1117] dark:to-[#161b27]">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold
            text-blue-600 dark:text-blue-400">
            <Zap className="w-8 h-8 fill-blue-600 dark:fill-blue-400" />
            TechShop
          </Link>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Điện tử chính hãng, giá tốt nhất
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-lg overflow-hidden
          bg-white dark:bg-slate-800/80
          border border-gray-100 dark:border-slate-700/60
          backdrop-blur-sm">

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-slate-700/60">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-4 text-sm font-semibold transition-colors
                  ${tab === t
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
              >
                {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* LOGIN */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                      text-gray-400 dark:text-slate-500" />
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className={`${inputCls} pl-10 pr-4`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                      text-gray-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className={`${inputCls} pl-10 pr-10`}
                      required
                    />
                    <EyeBtn />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors
                    bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400
                    disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </form>
            )}

            {/* REGISTER */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className={labelCls}>Họ và tên</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                      text-gray-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                      className={`${inputCls} pl-10 pr-4`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                      text-gray-400 dark:text-slate-500" />
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className={`${inputCls} pl-10 pr-4`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                      text-gray-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Tối thiểu 8 ký tự"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className={`${inputCls} pl-10 pr-10`}
                      required
                    />
                    <EyeBtn />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Xác nhận mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                      text-gray-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nhập lại mật khẩu"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      className={`${inputCls} pl-10 pr-4`}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors
                    bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400
                    disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                </button>
              </form>
            )}

            <p className="mt-4 text-center text-sm text-gray-500 dark:text-slate-400">
              <Link href="/" className="font-medium transition-colors
                text-blue-600 dark:text-blue-400
                hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
                ← Quay về trang chủ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}