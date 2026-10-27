import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  CheckCircle,
  LogOut,
  RefreshCw,
  UserCheck,
  Users,
  UserX,
  Clock,
  Package,
  Upload,
  Folder,
  FileText,
  AlertCircle,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import { BASEURL, TOKEN } from '../../app';
import type { DashboardData } from '../types/dashboard';

const Dashboard = () => {
  const navigate = useNavigate();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(
    async (date: Date, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASEURL}v2/dashboard`, {
          params: { date: format(date, 'yyyy-MM-dd') },
          headers: { Authorization: `Bearer ${TOKEN()}` },
        });
        setData(res.data?.data ?? null);
        setLastUpdated(new Date());
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          'Failed to load dashboard data.';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchDashboard(selectedDate);
  }, [selectedDate, fetchDashboard]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) setSelectedDate(date);
  };

  const staff = data?.staff;
  const attendance = data?.attendance;
  const projects = data?.projects;

  const enrollPct =
    staff && staff.total_active > 0
      ? Math.round((staff.total_enrolled / staff.total_active) * 100)
      : 0;

  const attendanceCards = [
    {
      title: 'Checked In',
      count: attendance?.checked_in ?? 0,
      icon: <CheckCircle className='h-7 w-7 text-green-600' />,
      iconBg: 'bg-green-50',
      accent: 'border-l-green-500',
      sub: `of ${staff?.total_active ?? 0} active staff`,
    },
    {
      title: 'Checked Out',
      count: attendance?.checked_out ?? 0,
      icon: <LogOut className='h-7 w-7 text-amber-600' />,
      iconBg: 'bg-amber-50',
      accent: 'border-l-amber-500',
      sub: 'completed for the day',
    },
    {
      title: 'Still Inside',
      count: attendance?.still_inside ?? 0,
      icon: <Clock className='h-7 w-7 text-blue-600' />,
      iconBg: 'bg-blue-50',
      accent: 'border-l-blue-500',
      sub: 'checked in, not yet out',
    },
    {
      title: 'Absent',
      count: attendance?.absent ?? 0,
      icon: <UserX className='h-7 w-7 text-red-600' />,
      iconBg: 'bg-red-50',
      accent: 'border-l-red-500',
      sub: 'no check-in or checkout recorded',
    },
  ];

  // Quick actions - keeping the existing ones
  const quickActions = [
    {
      label: 'Bulk Attendance',
      icon: <Package className='h-5 w-5' />,
      onClick: () => navigate('/bulk-attendance'),
      description: 'Mark attendance for multiple employees',
    },
    {
      label: 'Employees',
      icon: <Upload className='h-5 w-5' />,
      onClick: () => navigate('/master/employees'),
      description: 'Import employee list via Tanseeq API or Excel',
    },
    {
      label: 'View Projects',
      icon: <Folder className='h-5 w-5' />,
      onClick: () => navigate('/master/projects'),
      description: 'Navigate directly to the Projects submenu',
    },
    {
      label: 'Attendance Reports',
      icon: <FileText className='h-5 w-5' />,
      onClick: () => navigate('/reports'),
      description: 'View and export attendance history and records',
    },
  ];

  const trendData = (data?.trend_last_7_days ?? []).map((t) => ({
    ...t,
    label: format(parseISO(t.date), 'EEE'),
    fullDate: format(parseISO(t.date), 'dd MMM'),
  }));

  const topProjects = projects?.top_projects_today ?? [];
  const maxTopCount = Math.max(1, ...topProjects.map((p) => p.checkin_count));
  const breakdown = projects?.checkins_by_project ?? [];

  const attendanceRate =
    staff && staff.total_active > 0
      ? Math.round(((staff.total_active - (attendance?.absent ?? 0)) / staff.total_active) * 100)
      : 0;

  return (
    <div className='space-y-6'>
      <div className='bg-white p-4 rounded-lg shadow-sm'>
        {/* Dashboard header with date picker */}
        <div className='flex flex-wrap items-center justify-between gap-2 mb-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-800'>Dashboard</h1>
            {lastUpdated && (
              <p className='text-xs text-gray-400 mt-0.5'>
                Last updated {format(lastUpdated, 'dd MMM yyyy, hh:mm a')}
              </p>
            )}
          </div>

          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='icon'
              className='border-gray-200 bg-white'
              onClick={() => fetchDashboard(selectedDate, true)}
              disabled={loading || refreshing}
              title='Refresh dashboard'
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
              />
            </Button>

            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  className='flex items-center gap-2 border-gray-200 bg-white'
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                >
                  <Calendar className='h-4 w-4' />
                  <span>{format(selectedDate, 'dd MMM yyyy')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='end'>
                <CalendarComponent
                  mode='single'
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      handleDateChange(date);
                      setIsDatePickerOpen(false);
                    }
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                  classNames={{
                    day_disabled:
                      'text-gray-400 bg-gray-100 opacity-50 cursor-not-allowed hover:bg-gray-100',
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Error state */}
        {error && !loading && (
          <Card className='p-6 mb-6 border-red-200 bg-red-50'>
            <div className='flex items-center gap-3'>
              <AlertCircle className='h-6 w-6 text-red-500 shrink-0' />
              <div className='flex-1'>
                <p className='font-medium text-red-700'>
                  Could not load dashboard
                </p>
                <p className='text-sm text-red-600'>{error}</p>
              </div>
              <Button
                variant='outline'
                className='border-red-300 text-red-700 hover:bg-red-100'
                onClick={() => fetchDashboard(selectedDate)}
              >
                <RefreshCw className='h-4 w-4 mr-2' />
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Attendance rate bar */}
        {!loading && data && (
          <div className='mb-5 p-4 bg-gray-50 rounded-lg'>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-sm font-medium text-gray-600'>
                Attendance Rate — {format(selectedDate, 'dd MMM yyyy')}
              </span>
              <span className='text-sm font-bold text-gray-800'>
                {attendanceRate}%&nbsp;
                <span className='font-normal text-gray-400'>
                  ({((staff?.total_active ?? 0) - (attendance?.absent ?? 0)).toLocaleString()} /{' '}
                  {(staff?.total_active ?? 0).toLocaleString()})
                </span>
              </span>
            </div>
            <Progress value={attendanceRate} className='h-3' />
          </div>
        )}

        {/* Attendance KPI cards */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4'>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className='p-5'>
                  <div className='flex items-start justify-between'>
                    <div className='space-y-2'>
                      <Skeleton className='h-4 w-24' />
                      <Skeleton className='h-8 w-16' />
                      <Skeleton className='h-3 w-28' />
                    </div>
                    <Skeleton className='h-12 w-12 rounded-full' />
                  </div>
                </Card>
              ))
            : attendanceCards.map((card) => (
                <Card
                  key={card.title}
                  className={cn(
                    'p-5 border-l-4 hover:shadow-md transition-shadow',
                    card.accent,
                  )}
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='text-sm font-medium text-gray-500'>
                        {card.title}
                      </p>
                      <p className='text-3xl font-bold text-gray-900 mt-1'>
                        {card.count.toLocaleString()}
                      </p>
                      <p className='text-xs text-gray-400 mt-1'>{card.sub}</p>
                    </div>
                    <div className={cn('p-3 rounded-full', card.iconBg)}>
                      {card.icon}
                    </div>
                  </div>
                </Card>
              ))}
        </div>

        {/* Staff & project summary cards */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6'>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className='p-5'>
                <div className='space-y-3'>
                  <Skeleton className='h-4 w-32' />
                  <Skeleton className='h-8 w-20' />
                  <Skeleton className='h-2 w-full' />
                </div>
              </Card>
            ))
          ) : (
            <>
              <Card className='p-5 hover:shadow-md transition-shadow'>
                <div className='flex items-start justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-500'>
                      Active Staff
                    </p>
                    <p className='text-3xl font-bold text-gray-900 mt-1'>
                      {(staff?.total_active ?? 0).toLocaleString()}
                    </p>
                    <p className='text-xs text-gray-400 mt-1'>
                      employees currently active
                    </p>
                  </div>
                  <div className='p-3 rounded-full bg-indigo-50'>
                    <Users className='h-7 w-7 text-indigo-600' />
                  </div>
                </div>
              </Card>

              <Card className='p-5 hover:shadow-md transition-shadow'>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-500'>
                      Face Enrolled
                    </p>
                    <div className='flex items-baseline gap-2 mt-1'>
                      <p className='text-3xl font-bold text-gray-900'>
                        {(staff?.total_enrolled ?? 0).toLocaleString()}
                      </p>
                      <span className='text-sm text-gray-400'>
                        / {(staff?.total_active ?? 0).toLocaleString()}
                      </span>
                      <Badge
                        variant='outline'
                        className='bg-blue-50 text-blue-600 border-blue-200 ml-auto'
                      >
                        {enrollPct}%
                      </Badge>
                    </div>
                    <Progress value={enrollPct} className='h-2 mt-3' />
                    <p className='text-xs text-gray-400 mt-2'>
                      +{staff?.enrolled_this_week ?? 0} this week · +
                      {staff?.enrolled_this_month ?? 0} this month ·{' '}
                      {staff?.total_unenrolled ?? 0} pending
                    </p>
                  </div>
                  <div className='p-3 rounded-full bg-blue-50 ml-4'>
                    <UserCheck className='h-7 w-7 text-blue-600' />
                  </div>
                </div>
              </Card>

              <Card className='p-5 hover:shadow-md transition-shadow'>
                <div className='flex items-start justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-500'>
                      Active Projects
                    </p>
                    <p className='text-3xl font-bold text-gray-900 mt-1'>
                      {(projects?.total_active ?? 0).toLocaleString()}
                    </p>
                    <p className='text-xs text-gray-400 mt-1'>
                      {breakdown.length} with check-ins on{' '}
                      {format(selectedDate, 'dd MMM')}
                    </p>
                  </div>
                  <div className='p-3 rounded-full bg-purple-50'>
                    <Briefcase className='h-7 w-7 text-purple-600' />
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Trend chart + top projects */}
        <div className='grid grid-cols-1 gap-4 xl:grid-cols-3 mb-6'>
          <Card className='p-5 xl:col-span-2'>
            <div className='flex items-center gap-2 mb-4'>
              <TrendingUp className='h-5 w-5 text-proscape' />
              <h2 className='text-sm font-semibold text-gray-700'>
                Attendance Trend — Last 7 Days
              </h2>
            </div>
            {loading ? (
              <Skeleton className='h-64 w-full' />
            ) : trendData.length === 0 ? (
              <div className='h-64 flex items-center justify-center text-sm text-gray-400'>
                No attendance recorded in the last 7 days
              </div>
            ) : (
              <div className='h-64'>
                <ResponsiveContainer width='100%' height='100%'>
                  <AreaChart
                    data={trendData}
                    margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id='gradIn' x1='0' y1='0' x2='0' y2='1'>
                        <stop
                          offset='5%'
                          stopColor='#16a34a'
                          stopOpacity={0.25}
                        />
                        <stop
                          offset='95%'
                          stopColor='#16a34a'
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id='gradOut' x1='0' y1='0' x2='0' y2='1'>
                        <stop
                          offset='5%'
                          stopColor='#d97706'
                          stopOpacity={0.25}
                        />
                        <stop
                          offset='95%'
                          stopColor='#d97706'
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} />
                    <XAxis
                      dataKey='label'
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                      }}
                    />
                    <Area
                      type='monotone'
                      dataKey='checked_in'
                      name='Checked In'
                      stroke='#16a34a'
                      strokeWidth={2}
                      fill='url(#gradIn)'
                    />
                    <Area
                      type='monotone'
                      dataKey='checked_out'
                      name='Checked Out'
                      stroke='#d97706'
                      strokeWidth={2}
                      fill='url(#gradOut)'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className='p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <Folder className='h-5 w-5 text-proscape' />
              <h2 className='text-sm font-semibold text-gray-700'>
                Top Projects — {format(selectedDate, 'dd MMM')}
              </h2>
            </div>
            {loading ? (
              <div className='space-y-4'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className='h-8 w-full' />
                ))}
              </div>
            ) : topProjects.length === 0 ? (
              <div className='h-48 flex flex-col items-center justify-center gap-2 text-center'>
                <Briefcase className='h-8 w-8 text-gray-300' />
                <p className='text-sm text-gray-400'>
                  No project check-ins for this date
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {topProjects.map((p, i) => (
                  <div key={i}>
                    <div className='flex items-center justify-between text-sm mb-1'>
                      <span
                        className='font-medium text-gray-700 truncate pr-2'
                        title={p.projectname ?? 'Unassigned'}
                      >
                        {p.projectname ?? 'Unassigned'}
                      </span>
                      <span className='text-gray-500 shrink-0'>
                        {p.checkin_count.toLocaleString()}
                      </span>
                    </div>
                    <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-proscape rounded-full transition-all'
                        style={{
                          width: `${(p.checkin_count / maxTopCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Project-wise attendance breakdown */}
        <Card className='p-5 mb-6'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <Briefcase className='h-5 w-5 text-proscape' />
              <h2 className='text-sm font-semibold text-gray-700'>
                Project-wise Attendance — {format(selectedDate, 'dd MMM yyyy')}
              </h2>
            </div>
            {!loading && breakdown.length > 0 && (
              <Badge variant='outline' className='text-gray-500 border-gray-300'>
                {breakdown.length} project{breakdown.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {loading ? (
            <div className='space-y-3'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          ) : breakdown.length === 0 ? (
            <div className='py-10 flex flex-col items-center gap-3 text-center'>
              <Briefcase className='h-10 w-10 text-gray-200' />
              <p className='text-sm text-gray-400'>
                No project check-ins for this date
              </p>
            </div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className='text-right'>Checked In</TableHead>
                      <TableHead className='text-right'>Checked Out</TableHead>
                      <TableHead className='text-right'>Still Inside</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdown.map((row, i) => (
                      <TableRow key={row.project_guid ?? i}>
                        <TableCell className='font-medium text-gray-800'>
                          {row.projectname}
                        </TableCell>
                        <TableCell className='text-gray-500'>
                          {row.entityname ?? '—'}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Badge
                            variant='outline'
                            className='bg-green-50 text-green-700 border-green-200'
                          >
                            {row.checked_in.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Badge
                            variant='outline'
                            className='bg-amber-50 text-amber-700 border-amber-200'
                          >
                            {row.checked_out.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Badge
                            variant='outline'
                            className='bg-blue-50 text-blue-700 border-blue-200'
                          >
                            {row.still_inside.toLocaleString()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>

        {/* Quick Actions Section */}
        <div className='bg-gray-50 p-4 rounded-lg'>
          <h2 className='text-sm font-medium text-gray-500 mb-3'>
            QUICK ACTIONS
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4'>
            {quickActions.map((action, index) => (
              <div key={index} className='flex flex-col'>
                <Button
                  variant='outline'
                  className='flex flex-col items-center gap-2 p-4 h-auto border-gray-200 hover:bg-proscape/5 hover:border-proscape hover:shadow-sm transition-all'
                  onClick={action.onClick}
                  title={action.description}
                >
                  <div className='w-10 h-10 rounded-full bg-proscape/10 flex items-center justify-center text-proscape'>
                    {action.icon}
                  </div>
                  <span className='font-medium text-sm'>{action.label}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
