import { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PerformanceChartProps {
  data?: {
    labels: string[];
    values: number[];
  };
  timeframe: '24h' | '7d' | '30d' | 'all';
  onTimeframeChange: (timeframe: '24h' | '7d' | '30d' | 'all') => void;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  timeframe,
  onTimeframeChange,
}) => {
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<ChartData<'line'>>({
    datasets: [],
  });

  useEffect(() => {
    if (!data) return;

    const gradient = chartRef.current?.ctx?.createLinearGradient(0, 0, 0, 400);
    
    if (gradient) {
      gradient.addColorStop(0, 'rgba(52, 152, 219, 0.2)');
      gradient.addColorStop(1, 'rgba(52, 152, 219, 0)');
    }

    setChartData({
      labels: data.labels,
      datasets: [
        {
          label: 'Balance (SOL)',
          data: data.values,
          borderColor: 'rgba(52, 152, 219, 1)',
          backgroundColor: gradient || 'rgba(52, 152, 219, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(52, 152, 219, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    });
  }, [data]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false,
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          callback: (value) => `${value} SOL`,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        titleColor: 'rgba(255, 255, 255, 0.8)',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(52, 152, 219, 0.5)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y} SOL`;
          }
        }
      },
    },
  };

  return (
    <div className="bg-background-card p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Performance Chart</h2>
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === '24h'
                ? 'bg-primary text-white'
                : 'bg-background-elevated text-gray-300'
            }`}
            onClick={() => onTimeframeChange('24h')}
          >
            24h
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === '7d'
                ? 'bg-primary text-white'
                : 'bg-background-elevated text-gray-300'
            }`}
            onClick={() => onTimeframeChange('7d')}
          >
            7d
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === '30d'
                ? 'bg-primary text-white'
                : 'bg-background-elevated text-gray-300'
            }`}
            onClick={() => onTimeframeChange('30d')}
          >
            30d
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === 'all'
                ? 'bg-primary text-white'
                : 'bg-background-elevated text-gray-300'
            }`}
            onClick={() => onTimeframeChange('all')}
          >
            All
          </button>
        </div>
      </div>
      <div className="chart-container" style={{ height: '250px' }}>
        {data ? (
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        ) : (
          <div className="flex items-center justify-center h-full w-full text-gray-400">
            Loading chart data...
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceChart;
