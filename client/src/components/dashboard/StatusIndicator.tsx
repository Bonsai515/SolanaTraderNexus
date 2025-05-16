/**
 * Status Indicator Component
 * 
 * A visual indicator for system status
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'warning' | 'error';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'inactive':
        return 'text-gray-500';
      case 'warning':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'inactive':
        return <Clock className="h-8 w-8 text-gray-500" />;
      case 'warning':
        return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Clock className="h-8 w-8 text-gray-500" />;
    }
  };
  
  return (
    <div className="flex items-center space-x-2">
      {getStatusIcon(status)}
    </div>
  );
};

export default StatusIndicator;