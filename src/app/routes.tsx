import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { RequireAuth, RequirePermission } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewBookingPage } from './pages/NewBookingPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { QueuePage } from './pages/QueuePage';
import { SchedulePage } from './pages/SchedulePage';
import { ResourcesPage } from './pages/ResourcesPage';
import { LabTasksPage } from './pages/LabTasksPage';
import { AllBookingsPage } from './pages/AllBookingsPage';
import { UsersPage } from './pages/UsersPage';
import { EmailLogPage } from './pages/EmailLogPage';
import { ProfilePage } from './pages/ProfilePage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'book', element: <NewBookingPage /> },
          { path: 'bookings', element: <MyBookingsPage /> },
          { path: 'queue', element: <QueuePage /> },
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'resources', element: <ResourcesPage /> },
          { path: 'profile', element: <ProfilePage /> },
          {
            element: <RequirePermission permission="manageLabTasks" />,
            children: [{ path: 'lab-tasks', element: <LabTasksPage /> }],
          },
          {
            element: <RequirePermission permission="viewAllBookings" />,
            children: [{ path: 'all-bookings', element: <AllBookingsPage /> }],
          },
          {
            element: <RequirePermission permission="manageUsers" />,
            children: [{ path: 'users', element: <UsersPage /> }],
          },
          {
            element: <RequirePermission permission="viewEmailLog" />,
            children: [{ path: 'emails', element: <EmailLogPage /> }],
          },
          { path: '*', element: <Navigate to="/app/dashboard" replace /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
