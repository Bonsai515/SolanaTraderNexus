interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: string;
  iconColor: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  icon,
  iconColor,
  trend,
}) => {
  return (
    <div className="bg-background-card p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
          {trend && (
            <p
              className={`${
                trend.isPositive ? "text-success" : "text-danger"
              } text-sm flex items-center mt-1`}
            >
              <span className="material-icons mr-1 text-xs">
                {trend.isPositive ? "arrow_upward" : "arrow_downward"}
              </span>
              <span>{trend.value}</span>
            </p>
          )}
          {subValue && <p className="text-white text-sm mt-1">{subValue}</p>}
        </div>
        <div className={`bg-${iconColor} bg-opacity-20 p-2 rounded-lg`}>
          <span className={`material-icons text-${iconColor}`}>{icon}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
