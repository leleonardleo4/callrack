import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { LandingPage } from '@/pages/LandingPage';
import { CapabilitiesPage } from '@/pages/CapabilitiesPage';
import { CapabilityDetailPage } from '@/pages/CapabilityDetailPage';
import { DocsPage } from '@/pages/DocsPage';
import { PlaygroundPage } from '@/pages/PlaygroundPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ErrorPage } from '@/pages/ErrorPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/capabilities', element: <CapabilitiesPage /> },
      { path: '/capabilities/:capability', element: <CapabilityDetailPage /> },
      { path: '/docs', element: <DocsPage /> },
      { path: '/playground', element: <PlaygroundPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
