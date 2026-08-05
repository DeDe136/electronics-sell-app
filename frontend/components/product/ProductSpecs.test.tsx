import { render, screen } from '@testing-library/react';
import { ProductSpecs } from './ProductSpecs';

describe('ProductSpecs', () => {
  it('renders nothing when specs is empty', () => {
    const { container } = render(<ProductSpecs specs={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders known spec keys using their Vietnamese label', () => {
    render(<ProductSpecs specs={{ ram: '8GB', storage: '256GB' }} />);

    expect(screen.getByText('RAM')).toBeInTheDocument();
    expect(screen.getByText('8GB')).toBeInTheDocument();
    expect(screen.getByText('Bộ nhớ trong')).toBeInTheDocument();
    expect(screen.getByText('256GB')).toBeInTheDocument();
  });

  it('falls back to the raw key when there is no known label', () => {
    render(<ProductSpecs specs={{ unknownField: 'giá trị lạ' }} />);

    expect(screen.getByText('unknownField')).toBeInTheDocument();
    expect(screen.getByText('giá trị lạ')).toBeInTheDocument();
  });

  it('shows the section heading when there is at least one spec', () => {
    render(<ProductSpecs specs={{ cpu: 'Snapdragon 8 Gen 3' }} />);

    expect(screen.getByText('Thông số kỹ thuật')).toBeInTheDocument();
  });
});
