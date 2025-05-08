import React from 'react';

interface SystemComponent {
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  status: 'Active' | 'Ready' | 'Scanning' | 'Secured' | 'Offline';
}

interface AISystemPanelProps {
  components: SystemComponent[];
}

const AISystemPanel: React.FC<AISystemPanelProps> = ({ components }) => {
  return (
    <div className="space-y-4">
      {components.map((component, index) => (
        <div key={index} className="flex justify-between items-center p-3 bg-background-elevated rounded-md">
          <div className="flex items-center">
            <span className={`material-icons text-${component.iconColor} mr-2`}>{component.icon}</span>
            <div>
              <h4 className="font-medium">{component.name}</h4>
              <p className="text-xs text-gray-400">{component.description}</p>
            </div>
          </div>
          <div className="flex items-center">
            <span className={`h-2 w-2 rounded-full ${component.status === 'Offline' ? 'bg-danger' : 'bg-success'} mr-2`}></span>
            <span className={`text-sm ${component.status === 'Offline' ? 'text-danger' : 'text-success'}`}>
              {component.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AISystemPanel;
