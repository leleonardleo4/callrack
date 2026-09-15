import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

describe('Web App Component', () => {
  it('renders Callrack title and phase badge', () => {
    render(<App />);
    expect(screen.getByText('Callrack')).toBeDefined();
    expect(screen.getByText('Phase 0: Repository Foundation')).toBeDefined();
  });
});
