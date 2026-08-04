import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Đặt hàng</Button>);

    expect(screen.getByRole('button', { name: 'Đặt hàng' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Bấm vào đây</Button>);

    await user.click(screen.getByRole('button', { name: 'Bấm vào đây' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire onClick when the disabled prop is set', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Không khả dụng
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Không khả dụng' });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('is disabled and shows a spinner while loading', () => {
    render(<Button loading>Đang xử lý</Button>);

    const button = screen.getByRole('button', { name: 'Đang xử lý' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('does not fire onClick while loading', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <Button loading onClick={handleClick}>
        Đang xử lý
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Đang xử lý' }));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies the danger variant class', () => {
    render(<Button variant="danger">Xóa</Button>);

    expect(screen.getByRole('button', { name: 'Xóa' })).toHaveClass('bg-red-600');
  });

  it('applies the outline variant class', () => {
    render(<Button variant="outline">Hủy</Button>);

    expect(screen.getByRole('button', { name: 'Hủy' })).toHaveClass('border-blue-600');
  });

  it('merges a custom className with the default classes', () => {
    render(<Button className="custom-class">Nút</Button>);

    expect(screen.getByRole('button', { name: 'Nút' })).toHaveClass('custom-class');
  });
});
