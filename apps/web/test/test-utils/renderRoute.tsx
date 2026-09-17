import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { LandingPage } from '@/pages/LandingPage';
import { CapabilitiesPage } from '@/pages/CapabilitiesPage';
import { CapabilityDetailPage } from '@/pages/CapabilityDetailPage';
import { DocsPage } from '@/pages/DocsPage';
import { PlaygroundPage } from '@/pages/PlaygroundPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** The same route tree as src/router.tsx, using createMemoryRouter so tests control the initial path/history. */
export function renderRoute(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <RootLayout />,
        children: [
          { path: '/', element: <LandingPage /> },
          { path: '/capabilities', element: <CapabilitiesPage /> },
          { path: '/capabilities/:capability', element: <CapabilityDetailPage /> },
          { path: '/docs', element: <DocsPage /> },
          { path: '/playground', element: <PlaygroundPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );

  return { ...render(<RouterProvider router={router} />), router };
}
