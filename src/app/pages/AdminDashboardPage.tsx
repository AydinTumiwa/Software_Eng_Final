import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { analyticsData, bookings } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, Home, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/button';
import { authService } from '../utils/auth';
import { useNavigate } from 'react-router';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  if (!currentUser || currentUser.role !== 'admin') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const hourlyUtilizationData = analyticsData.utilizationByHour.map((item) => ({
    ...item,
    hour: item.hour.padStart(5, '0'),
  }));

  const stats = [
    {
      title: 'Total Bookings',
      value: analyticsData.totalBookings,
      icon: <Calendar className="h-5 w-5 text-primary" />,
      change: '+12% from last month'
    },
    {
      title: 'Room Utilization',
      value: `${analyticsData.roomUtilization}%`,
      icon: <TrendingUp className="h-5 w-5 text-accent" />,
      change: '+5% from last month'
    },
    {
      title: 'Pending Approvals',
      value: analyticsData.pendingApprovals,
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      change: 'Needs attention'
    },
    {
      title: 'Active Rooms',
      value: analyticsData.activeRooms,
      icon: <Home className="h-5 w-5 text-primary" />,
      change: '2 under maintenance'
    }
  ];

  const recentBookings = bookings
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of room bookings and system statistics
          </p>
        </div>
        <Button onClick={() => navigate('/app/admin/approvals')}>
          View Pending Approvals
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly Bookings Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.weeklyBookings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bookings" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Utilization by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={hourlyUtilizationData}
                margin={{ top: 12, right: 16, left: 0, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" interval={0} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickCount={6} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="utilization"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#06b6d4' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Booking Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Booking Requests</CardTitle>
            <Button variant="outline" onClick={() => navigate('/app/admin/approvals')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{booking.roomName}</h4>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {booking.userName} • {booking.building}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(booking.date).toLocaleDateString()} • {booking.startTime} - {booking.endTime}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Rooms */}
      <Card>
        <CardHeader>
          <CardTitle>Most Booked Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.topRooms.map((room, index) => (
              <div key={room.name} className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{room.name}</p>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(room.bookings / analyticsData.topRooms[0].bookings) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium">{room.bookings}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
