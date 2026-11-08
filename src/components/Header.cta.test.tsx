import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('@/lib/i18n', () => ({ useLocale: () => ({ copy: { nav: { links: ['Cases', 'Services', 'About', 'Experience', 'Contact'], cta: 'Discuss project' } } }) }));
vi.mock('./LanguageSwitcher', () => ({ LanguageSwitcher: () => <button>Language</button> }));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => <button>Theme</button> }));
import { Header } from './Header';
it('keeps navigation and toggles but removes CTA on desktop and mobile', () => {
  const { container } = render(<Header />);
  expect(screen.queryByText('Discuss project')).not.toBeInTheDocument();
  fireEvent.click(container.querySelector('button[aria-haspopup="dialog"]')!);
  expect(screen.queryByText('Discuss project')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Contact' })).toHaveLength(1);
  expect(screen.getByText('Theme')).toBeInTheDocument();
});
