import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { analyticsData } from '../data/mockData';
import { authService } from '../utils/auth';
import { useNavigate } from 'react-router';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar, Download, TrendingUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';

export function AnalyticsPage() {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  if (!currentUser || currentUser.role !== 'admin') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const [dateRange, setDateRange] = useState('last-30-days');

  const handleExport = (format: 'csv' | 'pdf') => {
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  const chartColor = '#2563EB';

  const utilizationData = [
    { name: 'Utilized', value: analyticsData.roomUtilization },
    { name: 'Available', value: 100 - analyticsData.roomUtilization }
  ];

  const COLORS = [
    chartColor,
    'rgba(37, 99, 235, 0.35)',
  ];

  const roomTypeData = [
    { type: 'Classroom', bookings: 450 },
    { type: 'Lab', bookings: 320 },
    { type: 'Lecture Hall', bookings: 280 },
    { type: 'Meeting Room', bookings: 150 },
    { type: 'Seminar Room', bookings: 120 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics & Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into room utilization and bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-7-days">Last 7 Days</SelectItem>
              <SelectItem value="last-30-days">Last 30 Days</SelectItem>
              <SelectItem value="last-90-days">Last 90 Days</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analyticsData.totalBookings}</div>
            <div className="flex items-center gap-1 text-sm text-accent mt-1">
              <TrendingUp className="h-4 w-4" />
              <span>+12% from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analyticsData.roomUtilization}%</div>
            <div className="flex items-center gap-1 text-sm text-accent mt-1">
              <TrendingUp className="h-4 w-4" />
              <span>+5% from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analyticsData.activeRooms}</div>
            <p className="text-sm text-muted-foreground mt-1">
              2 under maintenance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Booking Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">2.5h</div>
            <p className="text-sm text-muted-foreground mt-1">
              Per booking
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly Bookings Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Booking Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.weeklyBookings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bookings" fill={chartColor} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Room Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Room Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={utilizationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }: { name?: string; value?: number }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill={chartColor}
                  dataKey="value"
                >
                  {utilizationData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Peak Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.utilizationByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="utilization"
                  stroke={chartColor}
                  strokeWidth={3}
                  dot={{ r: 4, fill: chartColor }}
                  activeDot={{ r: 6, fill: chartColor }}
                  connectNulls
                  name="Utilization %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bookings by Room Type */}
        <Card>
          <CardHeader>
            <CardTitle>Bookings by Room Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roomTypeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="type" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="bookings" fill={chartColor} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Most Booked Rooms */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Most Booked Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.topRooms.map((room, index) => (
              <div key={room.name} className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold text-lg">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">{room.name}</p>
                    <span className="text-sm font-medium">{room.bookings} bookings</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(room.bookings / analyticsData.topRooms[0].bookings) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-medium mb-1">📈 Peak Utilization</p>
              <p className="text-sm text-muted-foreground">
                Thursday between 2-3 PM shows the highest room utilization at 85%
              </p>
            </div>
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
              <p className="font-medium mb-1">🎯 Optimization Opportunity</p>
              <p className="text-sm text-muted-foreground">
                Weekend bookings are low (15% utilization). Consider promoting weekend study sessions.
              </p>
            </div>
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <p className="font-medium mb-1">⚡ Popular Facilities</p>
              <p className="text-sm text-muted-foreground">
                Rooms with projectors and AC are 40% more likely to be booked.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
