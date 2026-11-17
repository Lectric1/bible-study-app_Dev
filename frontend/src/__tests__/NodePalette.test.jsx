import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NodePalette from '../components/NodePalette.jsx';

describe('NodePalette', () => {
  it('renders all 9 kinds', () => {
    render(<NodePalette onCreate={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(9);
  });

  it('calls onCreate with kind and null year on click', () => {
    const onCreate = vi.fn();
    render(<NodePalette onCreate={onCreate} />);
    fireEvent.click(screen.getByText('Event'));
    expect(onCreate).toHaveBeenCalledWith('event', null);
  });

  it('sets dataTransfer on drag start', () => {
    const onCreate = vi.fn();
    render(<NodePalette onCreate={onCreate} />);
    const btn = screen.getByText('Person');
    const dragEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragEvent, 'dataTransfer', {
      value: { setData: vi.fn(), effectAllowed: '' },
    });
    fireEvent(btn, dragEvent);
    expect(dragEvent.dataTransfer.setData).toHaveBeenCalledWith('application/x-node-kind', 'person');
  });
});
